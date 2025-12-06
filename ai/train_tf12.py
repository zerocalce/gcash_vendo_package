#!/usr/bin/env python3
"""
train_tf12.py
Training script compatible with TensorFlow 2.12.
"""

import os
import random
import numpy as np
import cv2
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import tensorflow as tf

# Configuration
DATA_ROOT = Path("../dataset")
IMG_SIZE = (64, 64)
BATCH_SIZE = 4
EPOCHS = 100
VALID_SPLIT = 0.3
RANDOM_SEED = 42

# Philippine peso denominations
CLASSES = ["20", "50", "100", "200", "500", "1000"]
NUM_CLASSES = len(CLASSES)

def set_seed(seed=RANDOM_SEED):
    random.seed(seed)
    np.random.seed(seed)
    tf.random.set_seed(seed)

def load_and_preprocess_image(path: Path, target_size=IMG_SIZE):
    """Load image, resize, and normalize to [0,1]."""
    img = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Could not read image: {path}")
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, target_size, interpolation=cv2.INTER_AREA)
    img = img.astype(np.float32) / 255.0
    return img

def load_dataset(data_root: Path):
    """Load images from class folders and return (X, y)."""
    X, y = [], []
    class_counts = {}
    
    for idx, cls in enumerate(CLASSES):
        cls_dir = data_root / cls
        if not cls_dir.is_dir():
            print(f"Warning: {cls_dir} not found. Skipping.")
            continue
        
        count = 0
        for img_path in cls_dir.glob("*"):
            if img_path.suffix.lower() not in {'.jpg', '.jpeg', '.png', '.bmp'}:
                continue
            try:
                img = load_and_preprocess_image(img_path)
                X.append(img)
                y.append(idx)
                count += 1
            except Exception as e:
                print(f"Failed to load {img_path}: {e}")
        
        class_counts[cls] = count
        print(f"Loaded {count} images for class {cls}")
    
    print(f"Class distribution: {class_counts}")
    return np.array(X), np.array(y)

def create_augmented_dataset(X, y):
    """Create augmented dataset to address class imbalance."""
    augmented_X, augmented_y = [], []
    
    # Count samples per class
    unique, counts = np.unique(y, return_counts=True)
    class_counts = dict(zip(unique, counts))
    max_count = max(counts)
    
    for class_idx in range(NUM_CLASSES):
        if class_idx not in class_counts:
            continue
            
        class_mask = y == class_idx
        class_X = X[class_mask]
        current_count = len(class_X)
        
        # Add original images
        augmented_X.extend(class_X)
        augmented_y.extend([class_idx] * current_count)
        
        # Add augmented images if needed
        if current_count < max_count:
            needed = max_count - current_count
            for i in range(needed):
                # Pick a random image from this class
                img = class_X[i % current_count].copy()
                
                # Simple augmentations
                if random.random() > 0.5:
                    # Horizontal flip
                    img = cv2.flip(img, 1)
                
                if random.random() > 0.5:
                    # Brightness adjustment
                    brightness = random.uniform(0.8, 1.2)
                    img = np.clip(img * brightness, 0, 1)
                
                if random.random() > 0.5:
                    # Small rotation
                    angle = random.uniform(-10, 10)
                    h, w = img.shape[:2]
                    center = (w//2, h//2)
                    M = cv2.getRotationMatrix2D(center, angle, 1.0)
                    img = cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REFLECT_101)
                
                augmented_X.append(img)
                augmented_y.append(class_idx)
    
    return np.array(augmented_X), np.array(augmented_y)

def build_model_tf12(input_shape=IMG_SIZE + (3,), num_classes=NUM_CLASSES):
    """Build CNN compatible with TensorFlow 2.12."""
    try:
        # Use TensorFlow 2.12 compatible API
        model = tf.keras.models.Sequential([
            tf.keras.layers.Input(shape=input_shape),
            tf.keras.layers.Conv2D(16, 3, activation='relu', padding='same'),
            tf.keras.layers.BatchNormalization(),
            tf.keras.layers.MaxPooling2D(),
            tf.keras.layers.Conv2D(32, 3, activation='relu', padding='same'),
            tf.keras.layers.BatchNormalization(),
            tf.keras.layers.MaxPooling2D(),
            tf.keras.layers.Conv2D(64, 3, activation='relu', padding='same'),
            tf.keras.layers.BatchNormalization(),
            tf.keras.layers.GlobalAveragePooling2D(),
            tf.keras.layers.Dropout(0.3),
            tf.keras.layers.Dense(num_classes, activation='softmax')
        ])
        
        model.compile(
            optimizer='adam',
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy']
        )
        
        return model
    except Exception as e:
        print(f"Model building error: {e}")
        return None

def main():
    set_seed()
    print("=== TensorFlow 2.12 Training Script ===")
    
    # Load dataset
    if not DATA_ROOT.exists():
        print(f"Dataset root {DATA_ROOT} not found.")
        return

    X, y = load_dataset(DATA_ROOT)
    if len(X) == 0:
        print("No images loaded. Check dataset structure.")
        return

    print(f"Loaded {len(X)} images across {NUM_CLASSES} classes.")
    
    # Create augmented dataset
    X_aug, y_aug = create_augmented_dataset(X, y)
    print(f"Augmented dataset size: {len(X_aug)} images")
    
    # Train/val split
    X_train, X_val, y_train, y_val = train_test_split(
        X_aug, y_aug, test_size=VALID_SPLIT, random_state=RANDOM_SEED
    )
    
    print(f"Train: {len(X_train)}, Val: {len(X_val)}")
    
    # Build model
    model = build_model_tf12()
    if model is None:
        print("Failed to build model.")
        return
    
    print("Model built successfully:")
    model.summary()
    
    # Callbacks
    callbacks = [
        tf.keras.callbacks.EarlyStopping(patience=15, restore_best_weights=True, monitor='val_loss'),
        tf.keras.callbacks.ModelCheckpoint('best_model_tf12.h5', save_best_only=True, monitor='val_loss'),
        tf.keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=8, min_lr=1e-6)
    ]
    
    # Train
    print("\nStarting training...")
    try:
        history = model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=EPOCHS,
            batch_size=BATCH_SIZE,
            callbacks=callbacks,
            verbose=1
        )
        
        # Evaluate
        print("\nEvaluating model...")
        val_pred = model.predict(X_val, verbose=0)
        val_pred_cls = np.argmax(val_pred, axis=1)
        
        print("\nValidation Classification Report:")
        # Get unique classes in validation set
        unique_labels = sorted(np.unique(y_val))
        unique_names = [CLASSES[i] for i in unique_labels]
        print(classification_report(y_val, val_pred_cls, labels=unique_labels, target_names=unique_names, zero_division=0))
        print("Confusion Matrix:")
        print(confusion_matrix(y_val, val_pred_cls))
        
        # Save final model
        model.save('bill_classifier_tf12.h5')
        print("\nModel saved to bill_classifier_tf12.h5")
        
        # Convert to TFLite
        try:
            converter = tf.lite.TFLiteConverter.from_keras_model(model)
            converter.optimizations = [tf.lite.Optimize.DEFAULT]
            tflite_model = converter.convert()
            with open('model_tf12.tflite', 'wb') as f:
                f.write(tflite_model)
            print("TFLite model saved to model_tf12.tflite")
        except Exception as e:
            print(f"TFLite conversion failed: {e}")
        
        print("\n=== Training Complete ===")
        print(f"Final validation accuracy: {history.history['val_accuracy'][-1]:.4f}")
        
    except Exception as e:
        print(f"Training failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
