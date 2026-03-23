import * as tf from "@tensorflow/tfjs";

// Labels that match the model output order (alphabetical, matching training)
export const LABELS = [
  "apple", "bowtie", "candle", "door", "envelope",
  "fish", "guitar", "ice cream", "lightning", "moon",
  "mountain", "star", "tent", "toothbrush", "wristwatch"
];

let model = null;
let modelLoading = false;

/**
 * Load the TF.js model from /model/model.json
 * Falls back to a mock model if the real model isn't found
 */
export async function loadModel() {
  if (model) return model;
  if (modelLoading) {
    while (modelLoading) await new Promise(r => setTimeout(r, 100));
    return model;
  }

  modelLoading = true;
  try {
    model = await tf.loadLayersModel("/model/model.json");
    console.log("[AI] Real model loaded successfully!");
  } catch (err) {
    console.warn("[AI] Could not load model, using mock mode:", err.message);
    model = createMockModel();
  }
  modelLoading = false;
  return model;
}

/**
 * Create a mock model that returns believable predictions
 */
function createMockModel() {
  return {
    predict: (tensor) => {
      const batchSize = tensor.shape[0];
      const data = new Float32Array(batchSize * LABELS.length);
      for (let b = 0; b < batchSize; b++) {
        let sum = 0;
        for (let i = 0; i < LABELS.length; i++) {
          data[b * LABELS.length + i] = Math.random();
          sum += data[b * LABELS.length + i];
        }
        for (let i = 0; i < LABELS.length; i++) {
          data[b * LABELS.length + i] /= sum;
        }
        if (Math.random() > 0.6) {
          const boostIdx = Math.floor(Math.random() * LABELS.length);
          const boostVal = 0.7 + Math.random() * 0.25;
          const remainder = 1 - boostVal;
          for (let i = 0; i < LABELS.length; i++) {
            data[b * LABELS.length + i] = i === boostIdx
              ? boostVal
              : (remainder / (LABELS.length - 1));
          }
        }
      }
      return tf.tensor2d(data, [batchSize, LABELS.length]);
    },
    _isMock: true,
  };
}

/**
 * Preprocess a canvas element for inference:
 * 1. Capture as ImageData
 * 2. Resize to 28×28 (model input size)
 * 3. Convert to grayscale + normalize [0,1]
 * 4. Return as 4D tensor [1, 28, 28, 1]
 */
export function preprocessCanvas(canvas) {
  return tf.tidy(() => {
    const SIZE = 28;
    const offscreen = document.createElement("canvas");
    offscreen.width = SIZE;
    offscreen.height = SIZE;
    const ctx = offscreen.getContext("2d");

    // Black background — white strokes (matches the Python blackboard approach)
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(canvas, 0, 0, SIZE, SIZE);

    const imageData = ctx.getImageData(0, 0, SIZE, SIZE);

    // Convert to grayscale — keep raw 0-255 range as float32 (NOT normalized)
    // This matches the Python reference: img = np.array(img, dtype=np.float32)
    const data = new Float32Array(SIZE * SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
      const r = imageData.data[i * 4];
      const g = imageData.data[i * 4 + 1];
      const b = imageData.data[i * 4 + 2];
      data[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0; // normalized 0-1 (training uses /255)
    }

    return tf.tensor4d(data, [1, SIZE, SIZE, 1]);
  });
}

/**
 * Run inference and return top-1 prediction
 */
export async function predict(model, tensor) {
  const prediction = model.predict(tensor);
  const probabilities = await prediction.data();
  prediction.dispose();

  let maxIdx = 0;
  let maxConf = 0;
  for (let i = 0; i < probabilities.length; i++) {
    if (probabilities[i] > maxConf) {
      maxConf = probabilities[i];
      maxIdx = i;
    }
  }

  return {
    label: LABELS[maxIdx],
    confidence: maxConf,
  };
}

// Humorous AI messages for failed predictions
export const FAIL_MESSAGES = [
  "What the hell is that? 🤔",
  "My neural networks are crying 😭",
  "Is that... modern art? 🎨",
  "I've seen better from a cat walking on a keyboard 🐱",
  "ERROR 404: Drawing not found 🔍",
  "I think my GPU just filed a complaint 💻",
  "Picasso would be... confused 😵",
  "My training data didn't prepare me for this 📊",
  "That's... certainly creative! 🌀",
  "Have you tried turning your hand off and on again? 🔄",
  "I'm going to need therapy after this 🛋️",
  "Bold artistic choices there 🎭",
  "My confidence is lower than my battery 🪫",
  "The AI judges you... poorly 👨‍⚖️",
  "Did you draw with your eyes closed? 👀",
];

export const SUCCESS_MESSAGES = [
  "Nailed it! 🎯",
  "You're an artist! 🎨",
  "My neurons are firing with joy! 🧠✨",
  "Now THAT's what I'm talking about! 🔥",
  "Crystal clear! 💎",
  "Perfectly recognizable! 👌",
  "10/10 would classify again! ⭐",
  "Your drawing skills are... adequate! 😏",
];

export function getRandomFailMessage() {
  return FAIL_MESSAGES[Math.floor(Math.random() * FAIL_MESSAGES.length)];
}

export function getRandomSuccessMessage() {
  return SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)];
}
