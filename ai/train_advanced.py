#!/usr/bin/env python3
"""
train_advanced.py
Advanced training script with hyperparameter optimization, data augmentation,
and enhanced validation for Philippine banknote classification.
Requires: tensorflow, opencv-python, numpy, scikit-learn, keras-tuner, imgaug
"""

import os
import random
import numpy as np
import cv2
from pathlib import Path
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.metrics import classification_report, confusion_matrix, precision_recall_fscore_support
import tensorflow as tf
from tensorflow.keras import layers, models, callbacks, mixed_precision
from tensorflow.keras.preprocessing.image import ImageDataGenerator
import keras_tuner as kt
import json
from datetime import datetime

# Configuration
DATA_ROOT = Path("../dataset")
IMG_SIZE = (128, 128)  # Higher resolution for better feature extraction
BATCH_SIZE = 16
EPOCHS = 100
VALID_SPLIT = 0.2
TEST_SPLIT = 0.1
RANDOM_SEED = 42

# Philippine peso denominations
CLASSES = ["20", "50", "100", "200", "500", "1000"]
NUM_CLASSES = len(CLASSES)

# Enable mixed precision for faster training
policy = mixed_precision.Policy('mixed_float16')
mixed_precision.set_global_policy(policy)

def set_seed(seed=RANDOM_SEED):
    random.seed(seed)
    np.random.seed(seed)
    tf.random.set_seed(seed)
    os.environ['PYTHONHASHSEED'] = str(seed)

def advanced_preprocess_image(path: Path, target_size=IMG_SIZE, augment=False):
    """Advanced image preprocessing with augmentation options."""
    img = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Could not read image: {path}")
    
    # Convert color space
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    # Noise reduction
    img = cv2.fastNlMeansDenoisingColored(img, None, 10, 10, 7, 21)
    
    # Contrast enhancement using CLAHE
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    lab[:,:,0] = clahe.apply(lab[:,:,0])
    img = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
    
    # Resize with high-quality interpolation
    img = cv2.resize(img, target_size, interpolation=cv2.INTER_LANCZOS4)
    
    # Data augmentation (training only)
    if augment:
        # Random rotation
        angle = random.uniform(-15, 15)
        h, w = img.shape[:2]
        center = (w//2, h//2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        img = cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REFLECT_101)
        
        # Random brightness and contrast
        brightness = random.uniform(0.8, 1.2)
        contrast = random.uniform(0.8, 1.2)
        img = cv2.convertScaleAbs(img, alpha=brightness, beta=contrast)
        
        # Random horizontal flip (for banknotes, this is realistic)
        if random.random() > 0.5:
            img = cv2.flip(img, 1)
    
    # Normalize to [0,1]
    img = img.astype(np.float32) / 255.0
    
    return img

def load_dataset(data_root: Path, augment=False):
    """Load images with advanced preprocessing."""
    X, y = [], []
    for idx, cls in enumerate(CLASSES):
        cls_dir = data_root / cls
        if not cls_dir.is_dir():
            print(f"Warning: {cls_dir} not found. Skipping.")
            continue
        for img_path in cls_dir.glob("*"):
            if img_path.suffix.lower() not in {'.jpg', '.jpeg', '.png', '.bmp'}:
                continue
            try:
                img = advanced_preprocess_image(img_path, augment=augment)
                X.append(img)
                y.append(idx)
            except Exception as e:
                print(f"Failed to load {img_path}: {e}")
    return np.array(X), np.array(y)

def build_advanced_model(hp):
    """Build model with hyperparameter tuning."""
    inputs = layers.Input(shape=IMG_SIZE + (3,))
    
    # Data augmentation layer
    x = layers.RandomFlip("horizontal")(inputs)
    x = layers.RandomRotation(0.1)(x)
    x = layers.RandomZoom(0.1)(x)
    x = layers.RandomContrast(0.1)(x)
    
    # Feature extraction blocks
    num_blocks = hp.Int('num_blocks', 3, 5)
    filters = hp.Int('initial_filters', 32, 64, step=16)
    
    for i in range(num_blocks):
        x = layers.Conv2D(
            filters * (2**i), 
            hp.Choice('kernel_size', [3, 5]), 
            activation='relu', 
            padding='same',
            kernel_regularizer=tf.keras.regularizers.l2(hp.Float('l2_reg', 1e-4, 1e-2, sampling='log'))
        )(x)
        x = layers.BatchNormalization()(x)
        x = layers.Conv2D(
            filters * (2**i), 
            hp.Choice('kernel_size', [3, 5]), 
            activation='relu', 
            padding='same',
            kernel_regularizer=tf.keras.regularizers.l2(hp.Float('l2_reg', 1e-4, 1e-2, sampling='log'))
        )(x)
        x = layers.BatchNormalization()(x)
        x = layers.MaxPooling2D(pool_size=hp.Choice('pool_size', [2, 3]))(x)
        x = layers.Dropout(hp.Float('dropout', 0.2, 0.5, step=0.1))(x)
    
    # Classification head
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dense(
        hp.Int('dense_units', 128, 512, step=64), 
        activation='relu',
        kernel_regularizer=tf.keras.regularizers.l2(hp.Float('l2_reg', 1e-4, 1e-2, sampling='log'))
    )(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(hp.Float('dropout', 0.2, 0.5, step=0.1))(x)
    
    outputs = layers.Dense(NUM_CLASSES, activation='softmax', dtype='float32')(x)
    
    model = models.Model(inputs, outputs)
    
    # Optimizer with learning rate tuning
    learning_rate = hp.Float('learning_rate', 1e-4, 1e-2, sampling='log')
    optimizer = tf.keras.optimizers.Adam(
        learning_rate=learning_rate,
        clipnorm=hp.Float('clip_norm', 0.5, 2.0, step=0.5)
    )
    
    model.compile(
        optimizer=optimizer,
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy', tf.keras.metrics.Precision(), tf.keras.metrics.Recall()]
    )
    
    return model

def cross_validate_model(X, y, n_folds=5):
    """Perform cross-validation to assess model stability."""
    skf = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=RANDOM_SEED)
    cv_scores = []
    
    for fold, (train_idx, val_idx) in enumerate(skf.split(X, y)):
        print(f"\nFold {fold + 1}/{n_folds}")
        
        X_train_fold, X_val_fold = X[train_idx], X[val_idx]
        y_train_fold, y_val_fold = y[train_idx], y[val_idx]
        
        # Build and train model
        model = build_advanced_model(kt.HyperParameters())
        model.compile(
            optimizer='adam',
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy']
        )
        
        # Train with early stopping
        early_stop = callbacks.EarlyStopping(patience=10, restore_best_weights=True)
        
        history = model.fit(
            X_train_fold, y_train_fold,
            validation_data=(X_val_fold, y_val_fold),
            epochs=50,
            batch_size=BATCH_SIZE,
            callbacks=[early_stop],
            verbose=0
        )
        
        # Evaluate
        val_loss, val_acc = model.evaluate(X_val_fold, y_val_fold, verbose=0)
        cv_scores.append(val_acc)
        print(f"Fold accuracy: {val_acc:.4f}")
    
    print(f"\nCross-validation accuracy: {np.mean(cv_scores):.4f} ± {np.std(cv_scores):.4f}")
    return cv_scores

def evaluate_model_comprehensive(model, X_test, y_test):
    """Comprehensive model evaluation."""
    y_pred = model.predict(X_test)
    y_pred_classes = np.argmax(y_pred, axis=1)
    
    # Basic metrics
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred_classes, average='weighted')
    
    # Per-class metrics
    report = classification_report(y_test, y_pred_classes, target_names=CLASSES, output_dict=True)
    
    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred_classes)
    
    # Save results
    results = {
        'precision': precision,
        'recall': recall,
        'f1_score': f1,
        'per_class_metrics': report,
        'confusion_matrix': cm.tolist(),
        'timestamp': datetime.now().isoformat()
    }
    
    with open('evaluation_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n=== Comprehensive Evaluation ===")
    print(f"Weighted Precision: {precision:.4f}")
    print(f"Weighted Recall: {recall:.4f}")
    print(f"Weighted F1-Score: {f1:.4f}")
    print(f"\nPer-class results:")
    for cls in CLASSES:
        if cls in report:
            print(f"{cls}: P={report[cls]['precision']:.3f}, R={report[cls]['recall']:.3f}, F1={report[cls]['f1-score']:.3f}")
    
    return results

def main():
    set_seed()
    print("=== Advanced Banknote Classifier Training ===")
    
    # Load dataset
    if not DATA_ROOT.exists():
        print(f"Dataset root {DATA_ROOT} not found.")
        return
    
    print("Loading dataset with augmentation...")
    X, y = load_dataset(DATA_ROOT, augment=True)
    
    if len(X) == 0:
        print("No images loaded. Check dataset structure.")
        return
    
    print(f"Loaded {len(X)} images across {NUM_CLASSES} classes.")
    
    # Stratified split to maintain class distribution
    X_temp, X_test, y_temp, y_test = train_test_split(
        X, y, test_size=TEST_SPLIT, random_state=RANDOM_SEED, stratify=y
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp, y_temp, test_size=VALID_SPLIT/(1-TEST_SPLIT), 
        random_state=RANDOM_SEED, stratify=y_temp
    )
    
    print(f"Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    
    # Hyperparameter tuning
    print("\n=== Hyperparameter Tuning ===")
    tuner = kt.Hyperband(
        build_advanced_model,
        objective='val_accuracy',
        max_epochs=30,
        factor=3,
        directory='tuning_results',
        project_name='banknote_classifier'
    )
    
    early_stop = callbacks.EarlyStopping(patience=10, restore_best_weights=True)
    
    tuner.search(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=30,
        batch_size=BATCH_SIZE,
        callbacks=[early_stop]
    )
    
    # Get best model
    best_hps = tuner.get_best_hyperparameters(num_trials=1)[0]
    print(f"\nBest hyperparameters:")
    for param in best_hps.values:
        print(f"{param}: {best_hps.get(param)}")
    
    # Train final model with best hyperparameters
    print("\n=== Training Final Model ===")
    model = tuner.hypermodel.build(best_hps)
    
    # Enhanced callbacks
    cb = [
        callbacks.EarlyStopping(patience=20, restore_best_weights=True, monitor='val_accuracy'),
        callbacks.ModelCheckpoint('best_model.h5', save_best_only=True, monitor='val_accuracy'),
        callbacks.ReduceLROnPlateau(factor=0.5, patience=5, min_lr=1e-6),
        callbacks.TensorBoard(log_dir=f'logs/{datetime.now().strftime("%Y%m%d-%H%M%S")}')
    ]
    
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        callbacks=cb,
        verbose=2
    )
    
    # Cross-validation
    print("\n=== Cross-Validation ===")
    cv_scores = cross_validate_model(X_temp, y_temp)
    
    # Final evaluation
    print("\n=== Final Test Evaluation ===")
    results = evaluate_model_comprehensive(model, X_test, y_test)
    
    # Save models
    model.save('bill_classifier_advanced.h5')
    print("\nAdvanced model saved to bill_classifier_advanced.h5")
    
    # Convert to TFLite with optimizations
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]
    
    def representative_dataset():
        for i in range(min(100, len(X_test))):
            yield [X_test[i:i+1].astype(np.float32)]
    
    converter.representative_dataset = representative_dataset
    tflite_model = converter.convert()
    
    with open('model_advanced.tflite', 'wb') as f:
        f.write(tflite_model)
    print("Optimized TFLite model saved to model_advanced.tflite")
    
    # Save training history
    with open('training_history.json', 'w') as f:
        json.dump({k: [float(x) for x in v] for k, v in history.history.items()}, f, indent=2)
    
    print("\n=== Training Complete ===")
    print(f"Final test accuracy: {results['precision']:.4f}")
    print(f"Cross-validation accuracy: {np.mean(cv_scores):.4f} ± {np.std(cv_scores):.4f}")

if __name__ == '__main__':
    main()
