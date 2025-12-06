#!/usr/bin/env python3
"""
convert_model.py
Convert TFLite model to C header file for Arduino.
"""

import sys
from pathlib import Path

def tflite_to_header(tflite_path, header_path):
    """Convert TFLite model to C header file."""
    try:
        with open(tflite_path, 'rb') as f:
            model_data = f.read()
        
        with open(header_path, 'w') as f:
            f.write(f"// Auto-generated from {tflite_path.name}\n")
            f.write(f"const unsigned char g_model_data[] = {{\n")
            
            for i, byte in enumerate(model_data):
                if i % 16 == 0:
                    f.write("  ")
                f.write(f"0x{byte:02X}")
                if i < len(model_data) - 1:
                    f.write(", ")
                if (i + 1) % 16 == 0:
                    f.write("\n")
            
            f.write("\n};\n")
            f.write(f"const int g_model_data_len = {len(model_data)};\n")
        
        print(f"Converted {tflite_path} to {header_path}")
        print(f"Model size: {len(model_data)} bytes")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    tflite_path = Path("model_tf12.tflite")
    header_path = Path("../firmware/model_data.h")
    
    if not tflite_path.exists():
        print(f"TFLite model not found: {tflite_path}")
        sys.exit(1)
    
    if tflite_to_header(tflite_path, header_path):
        print("Conversion successful!")
    else:
        sys.exit(1)
