"""
preprocess.py
Image preprocessing utilities for bill classification on embedded devices.
Supports resizing, normalization, and quantization for TensorFlow Lite models.
"""

import cv2
import numpy as np
from PIL import Image
from typing import Tuple, Union

# Expected model input size (adjust to your model)
INPUT_SIZE = (64, 64)  # width, height

def resize_image(image: Union[np.ndarray, str, Image.Image], size: Tuple[int, int] = INPUT_SIZE) -> np.ndarray:
    """
    Resize image to target size using high-quality downsampling.
    Supports file path, numpy array, or PIL Image.
    """
    if isinstance(image, str):
        img = cv2.imread(image, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError(f"Could not read image from path: {image}")
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    elif isinstance(image, Image.Image):
        img = np.array(image.convert('RGB'))
    else:
        img = image.copy()

    # Use INTER_AREA for downsampling to reduce aliasing
    if img.shape[:2] != size[::-1]:
        img = cv2.resize(img, size, interpolation=cv2.INTER_AREA)
    return img

def normalize_image(image: np.ndarray, method: str = 'standard') -> np.ndarray:
    """
    Normalize pixel values.
    - 'standard': scale to [0, 1]
    - 'zero_center': scale to [-1, 1]
    - 'imagenet': ImageNet-style normalization (if pretrained)
    """
    img = image.astype(np.float32) / 255.0
    if method == 'zero_center':
        img = (img - 0.5) * 2.0
    elif method == 'imagenet':
        mean = np.array([0.485, 0.456, 0.406])
        std = np.array([0.229, 0.224, 0.225])
        img = (img - mean) / std
    return img

def quantize_image(image: np.ndarray, dtype: np.dtype = np.uint8) -> np.ndarray:
    """
    Quantize floating-point image to integer type for TFLite uint8 models.
    Assumes input is in [0, 1] range.
    """
    if image.dtype != np.uint8:
        # Scale to [0, 255] and clip
        img = np.clip(image * 255.0, 0, 255).astype(dtype)
    else:
        img = image
    return img

def preprocess_for_tflite(image: Union[np.ndarray, str, Image.Image],
                          size: Tuple[int, int] = INPUT_SIZE,
                          normalize: str = 'standard',
                          quantize: bool = True) -> np.ndarray:
    """
    Full preprocessing pipeline for TFLite Micro models.
    Returns shape (H, W, C) suitable for TFLite uint8 models.
    """
    # Resize
    img = resize_image(image, size)
    # Normalize
    img = normalize_image(img, method=normalize)
    # Quantize if required for uint8 models
    if quantize:
        img = quantize_image(img, np.uint8)
    return img

def augment_image(image: np.ndarray) -> np.ndarray:
    """
    Basic augmentation for training data: random brightness/contrast.
    """
    # Random brightness
    brightness = np.random.uniform(0.8, 1.2)
    img = np.clip(image * brightness, 0, 255).astype(np.uint8)
    # Random contrast
    contrast = np.random.uniform(0.8, 1.2)
    img = np.clip((img.astype(np.float32) - 128) * contrast + 128, 0, 255).astype(np.uint8)
    return img

def preprocess_batch(images: list, **kwargs) -> np.ndarray:
    """
    Preprocess a list of images and batch them into a numpy array.
    Returns shape (N, H, W, C).
    """
    processed = [preprocess_for_tflite(img, **kwargs) for img in images]
    return np.stack(processed, axis=0)

if __name__ == '__main__':
    # Quick demo
    demo_path = '../100 peso note .jpg'
    try:
        img = preprocess_for_tflite(demo_path)
        print(f"Preprocessed shape: {img.shape}, dtype: {img.dtype}")
        print(f"Value range: [{img.min()}, {img.max()}]")
    except Exception as e:
        print(f"Demo failed: {e}")
