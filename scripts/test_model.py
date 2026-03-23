import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import warnings
warnings.filterwarnings('ignore')
import numpy as np

# Suppress TF output
import logging
logging.getLogger('tensorflow').setLevel(logging.ERROR)

from tensorflow.keras.models import load_model

model = load_model(r'c:\Users\manol\OneDrive\Documents\Work Related\BP\game\QuickDraw.h5')

# Test with normalized white image (all 1.0)
white = np.ones((1,28,28,1), dtype=np.float32)
pred = model.predict(white, verbose=0)[0]

with open(r'c:\Users\manol\OneDrive\Documents\Work Related\BP\game\scripts\model_output.txt', 'w') as f:
    f.write("=== White image (all 1.0) ===\n")
    for i, p in enumerate(pred):
        f.write(f"Class {i}: {p:.6f}\n")
    f.write(f"\nWinner: class {np.argmax(pred)} ({pred.max():.4f})\n")
    
    # Test with blank
    blank = np.zeros((1,28,28,1), dtype=np.float32) 
    pred2 = model.predict(blank, verbose=0)[0]
    f.write(f"\n=== Blank image (all 0.0) ===\n")
    for i, p in enumerate(pred2):
        f.write(f"Class {i}: {p:.6f}\n")
    f.write(f"\nWinner: class {np.argmax(pred2)} ({pred2.max():.4f})\n")
