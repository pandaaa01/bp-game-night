"""Convert QuickDraw.h5 (legacy Keras) to TensorFlow.js format."""
import os, json
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv2D, MaxPooling2D, Flatten, Dense, Dropout
import h5py

MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'QuickDraw.h5')
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'client', 'public', 'model')

# ─── Rebuild architecture from config ─────────────────────────────
print("[1/4] Rebuilding model architecture...")
model = Sequential([
    Conv2D(32, (5,5), activation='relu', input_shape=(28, 28, 1)),
    MaxPooling2D((2,2), strides=2, padding='same'),
    Conv2D(64, (5,5), activation='relu'),
    MaxPooling2D((2,2), strides=2, padding='same'),
    Flatten(),
    Dense(512, activation='relu'),
    Dropout(0.6),
    Dense(128, activation='relu'),
    Dropout(0.6),
    Dense(15, activation='softmax'),
])
model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
model.summary()

# ─── Load weights from H5 ────────────────────────────────────────
print("\n[2/4] Loading weights from QuickDraw.h5...")
f = h5py.File(MODEL_PATH, 'r')
weight_group = f['model_weights']

# Map layer names from old Keras format to new model
layer_map = {
    'conv2d_1': 'conv2d',
    'conv2d_2': 'conv2d_1',
    'dense_1': 'dense',
    'dense_2': 'dense_1',
    'dense_3': 'dense_2',
}

for old_name, new_name in layer_map.items():
    layer = model.get_layer(new_name)
    # Old Keras stores weights under layer_name/layer_name/kernel:0, bias:0
    g = weight_group[old_name][old_name]
    kernel = np.array(g['kernel:0'])
    bias = np.array(g['bias:0'])
    layer.set_weights([kernel, bias])
    print(f"  ✓ {old_name} -> {new_name}: kernel={kernel.shape}, bias={bias.shape}")

f.close()
print("✓ All weights loaded!")

# ─── Test inference ───────────────────────────────────────────────
print("\n[3/4] Testing inference...")
dummy = np.random.rand(1, 28, 28, 1).astype(np.float32)
pred = model.predict(dummy, verbose=0)
print(f"  Output shape: {pred.shape}, sum: {pred.sum():.4f}")

LABELS = [
    'apple', 'bowtie', 'candle', 'door', 'envelope',
    'fish', 'guitar', 'ice cream', 'lightning', 'moon',
    'mountain', 'star', 'tent', 'toothbrush', 'wristwatch'
]
print(f"  Top prediction: {LABELS[np.argmax(pred)]} ({pred.max():.2%})")

# ─── Save as TF.js ───────────────────────────────────────────────
print(f"\n[4/4] Converting to TensorFlow.js: {OUTPUT_PATH}")
os.makedirs(OUTPUT_PATH, exist_ok=True)

# Save as .keras first, then convert via CLI
keras_path = os.path.join(os.path.dirname(__file__), '..', 'quickdraw_converted.keras')
model.save(keras_path)

# Try tensorflowjs Python module
try:
    import tensorflowjs as tfjs
    tfjs.converters.save_keras_model(model, OUTPUT_PATH)
    print("✓ Saved via tensorflowjs Python module!")
except ImportError:
    print("tensorflowjs module not available, trying CLI converter...")
    ret = os.system(f'tensorflowjs_converter --input_format=keras "{keras_path}" "{OUTPUT_PATH}"')
    if ret != 0:
        print("CLI converter failed. Trying manual JSON export...")
        # Manual export: save weights as binary + model.json
        import struct
        
        weights_data = bytearray()
        weights_manifest = []
        
        for layer in model.layers:
            layer_weights = layer.get_weights()
            for i, w in enumerate(layer_weights):
                name = f"{layer.name}/{['kernel', 'bias'][i]}"
                weights_data.extend(w.astype(np.float32).tobytes())
                weights_manifest.append({
                    "name": name,
                    "shape": list(w.shape),
                    "dtype": "float32"
                })
        
        # Write weights binary
        weights_path = os.path.join(OUTPUT_PATH, "group1-shard1of1.bin")
        with open(weights_path, 'wb') as wf:
            wf.write(bytes(weights_data))
        
        total_bytes = len(weights_data)
        
        # Build model.json
        model_json = {
            "format": "layers-model",
            "generatedBy": "manual-converter",
            "convertedBy": "manual-converter", 
            "modelTopology": json.loads(model.to_json()),
            "weightsManifest": [{
                "paths": ["group1-shard1of1.bin"],
                "weights": weights_manifest
            }]
        }
        
        model_json_path = os.path.join(OUTPUT_PATH, "model.json")
        with open(model_json_path, 'w') as jf:
            json.dump(model_json, jf)
        
        print(f"✓ Manual export complete! ({total_bytes:,} bytes)")

# List output files
print("\nOutput files:")
for f_name in sorted(os.listdir(OUTPUT_PATH)):
    size = os.path.getsize(os.path.join(OUTPUT_PATH, f_name))
    print(f"  {f_name} ({size:,} bytes)")

print("\n🎉 Done! Model ready in client/public/model/")
