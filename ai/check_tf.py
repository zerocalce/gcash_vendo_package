import tensorflow as tf
print('TensorFlow version:', tf.__version__)
print('Keras available:', hasattr(tf, 'keras'))
if hasattr(tf, 'keras'):
    print('Keras version:', tf.keras.__version__ if hasattr(tf.keras, '__version__') else 'Unknown')
