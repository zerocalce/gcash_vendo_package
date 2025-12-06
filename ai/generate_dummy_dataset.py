#!/usr/bin/env python3
"""
generate_dummy_dataset.py
Create minimal dummy images for classes with fewer than 2 images.
"""

import os
import random
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

DATA_ROOT = Path("dataset")
IMG_SIZE = (64, 64)
CLASSES = ["20", "50", "100", "200", "500", "1000"]

def generate_dummy_image(text: str, size=IMG_SIZE):
    """Generate a simple colored square with text."""
    img = Image.new('RGB', size, color=(random.randint(50, 200), random.randint(50, 200), random.randint(50, 200)))
    draw = ImageDraw.Draw(img)
    # Try to load a font; fallback to default
    try:
        font = ImageFont.truetype("arial.ttf", 20)
    except:
        font = ImageFont.load_default()
    # Draw text centered
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size[0] - text_w) // 2
    y = (size[1] - text_h) // 2
    draw.text((x, y), text, fill=(255, 255, 255), font=font)
    return img

def ensure_min_images(min_per_class=2):
    """Ensure each class has at least min_per_class images."""
    for cls in CLASSES:
        cls_dir = DATA_ROOT / cls
        cls_dir.mkdir(parents=True, exist_ok=True)
        existing = list(cls_dir.glob("*"))
        img_files = [p for p in existing if p.suffix.lower() in {'.jpg', '.jpeg', '.png', '.bmp'}]
        count = len(img_files)
        needed = max(0, min_per_class - count)
        if needed > 0:
            print(f"Class {cls}: generating {needed} dummy image(s) (existing: {count})")
            for i in range(needed):
                img = generate_dummy_image(cls)
                filename = f"dummy_{i+1}.png"
                img_path = cls_dir / filename
                img.save(img_path)
                print(f"  Created {img_path}")
        else:
            print(f"Class {cls}: already has {count} images (ok)")

if __name__ == "__main__":
    ensure_min_images()
    print("Dummy dataset generation complete.")
