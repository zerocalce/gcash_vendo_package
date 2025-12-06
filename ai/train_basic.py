#!/usr/bin/env python3
"""
train_basic.py
Basic training script compatible with current environment.
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
BATCH_SIZE = 8  # Smaller batch for small dataset
EPOCHS = 50
VALID_SPLIT = 0.2
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
    for idx, cls in enumerate(CLASSES):
        cls_dir = data_root / cls
        if not cls_dir.is_dir():
            print(f"Warning: {cls_dir} not found. Skipping.")
            continue
        for img_path in cls_dir.glob("*"):
            if img_path.suffix.lower() not in {'.jpg', '.jpeg', '.png', '.bmp'}:
                continue
            try:
                img = load_and_preprocess_image(img_path)
                X.append(img)
                y.append(idx)
            except Exception as e:
                print(f"Failed to load {img_path}: {e}")
    return np.array(X), np.array(y)

def build_model(input_shape=IMG_SIZE + (3,), num_classes=NUM_CLASSES):
    """Simple CNN for small images."""
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=input_shape),
        tf.keras.layers.Conv2D(32, 3, activation='relu', padding='same'),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.MaxPooling2D(),
        tf.keras.layers.Conv2D(64, 3, activation='relu', padding='same'),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.MaxPooling2D(),
        tf.keras.layers.Conv2D(128, 3, activation='relu', padding='same'),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.GlobalAveragePooling2D(),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(num_classes, activation='softmax')
    ])
    return model

def main():
    set_seed()
    print("=== Basic Training Script ===")
    
    # Load dataset
    if not DATA_ROOT.exists():
        print(f"Dataset root {DATA_ROOT} not found.")
        return

    X, y = load_dataset(DATA_ROOT)
    if len(X) == 0:
        print("No images loaded. Check dataset structure.")
        return

    print(f"Loaded {len(X)} images across {NUM_CLASSES} classes.")
    
    # Train/val split (no stratification for small dataset)
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=VALID_SPLIT, random_state=RANDOM_SEED
    )
    
    print(f"Train: {len(X_train)}, Val: {len(X_val)}")
    
    # Build model
    model = build_model()
    model.compile(
        optimizer='adam',
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    model.summary()
    
    # Callbacks
    cb = [
        tf.keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True),
        tf.keras.callbacks.ModelCheckpoint('best_model_basic.h5', save_best_only=True)
    ]
    
    # Train
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        callbacks=cb,
        verbose=2
    )
    
    # Evaluate
    val_pred = model.predict(X_val)
    val_pred_cls = np.argmax(val_pred, axis=1)
    
    print("\nValidation Classification Report:")
    print(classification_report(y_val, val_pred_cls, target_names=CLASSES))
    print("Confusion Matrix:")
    print(confusion_matrix(y_val, val_pred_cls))
    
    # Save final model
    model.save('bill_classifier_basic.h5')
    print("\nModel saved to bill_classifier_basic.h5")
    
    # Convert to TFLite
    try:
        converter = tf.lite.TFLiteConverter.from_keras_model(model)
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        tflite_model = converter.convert()
        with open('model_basic.tflite', 'wb') as f:
            f.write(tflite_model)
        print("TFLite model saved to model_basic.tflite")
    except Exception as e:
        print(f"TFLite conversion failed: {e}")

if __name__ == '__main__':
    main()
