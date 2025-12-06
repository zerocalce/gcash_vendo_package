#!/usr/bin/env python3
"""
train_simple.py
Minimal, reproducible training script for Philippine banknote classification.
Requires: tensorflow, opencv-python, numpy, scikit-learn
"""

import os
import random
import numpy as np
import cv2
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import tensorflow as tf
from tensorflow import keras
from keras import layers, models, callbacks

# Configuration
DATA_ROOT = Path("../dataset")
IMG_SIZE = (64, 64)
BATCH_SIZE = 32
EPOCHS = 20
VALID_SPLIT = 0.1
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
    inputs = layers.Input(shape=input_shape)
    x = layers.Conv2D(32, 3, activation='relu', padding='same')(inputs)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling2D()(x)
    x = layers.Conv2D(64, 3, activation='relu', padding='same')(x)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling2D()(x)
    x = layers.Conv2D(128, 3, activation='relu', padding='same')(x)
    x = layers.BatchNormalization()(x)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(num_classes, activation='softmax')(x)
    model = models.Model(inputs, outputs)
    return model

def main():
    set_seed()
    print("=== Training Bill Classifier ===")
    # Load dataset
    if not DATA_ROOT.exists():
        print(f"Dataset root {DATA_ROOT} not found. Creating dummy folders for demo.")
        DATA_ROOT.mkdir(parents=True, exist_ok=True)
        for cls in CLASSES:
            (DATA_ROOT / cls).mkdir(exist_ok=True)
        print("Please place images under dataset/<class_name>/*.jpg and re-run.")
        return

    X, y = load_dataset(DATA_ROOT)
    if len(X) == 0:
        print("No images loaded. Check dataset structure.")
        return

    print(f"Loaded {len(X)} images across {NUM_CLASSES} classes.")
    # Train/val split
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=VALID_SPLIT, random_state=RANDOM_SEED
    )
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
        callbacks.EarlyStopping(patience=5, restore_best_weights=True),
        callbacks.ModelCheckpoint('best_model.h5', save_best_only=True)
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
    # Determine which classes are present in validation set
    present_labels = sorted(np.unique(np.concatenate([y_val, val_pred_cls])))
    present_names = [CLASSES[i] for i in present_labels]
    print("\nValidation Classification Report:")
    print(classification_report(y_val, val_pred_cls, labels=present_labels, target_names=present_names))
    print("Confusion Matrix:")
    print(confusion_matrix(y_val, val_pred_cls))
    # Save final model
    model.save('bill_classifier.h5')
    print("\nModel saved to bill_classifier.h5")
    # Convert to TFLite
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()
    with open('model.tflite', 'wb') as f:
        f.write(tflite_model)
    print("TFLite model saved to model.tflite")

if __name__ == '__main__':
    main()
