import * as tf from "@tensorflow/tfjs";

// Labels that match the server word list and model output order
export const LABELS = [
  "apple", "bird", "boat", "book", "car",
  "cat", "clock", "cup", "dog", "fish",
  "flower", "hat", "heart", "house", "key",
  "moon", "shoe", "star", "sun", "tree"
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
    // Wait for the other loading call
    while (modelLoading) await new Promise(r => setTimeout(r, 100));
    return model;
  }

  modelLoading = true;
  try {
    model = await tf.loadLayersModel("/model/model.json");
    console.log("[AI] Model loaded successfully");
  } catch (err) {
    console.warn("[AI] Could not load model, using mock mode:", err.message);
    model = createMockModel();
  }
  modelLoading = false;
  return model;
}

/**
 * Create a mock model that returns believable predictions
 * This lets the game work before a real model is trained
 */
function createMockModel() {
  return {
    predict: (tensor) => {
      const batchSize = tensor.shape[0];
      // Generate random-ish predictions
      const data = new Float32Array(batchSize * LABELS.length);
      for (let b = 0; b < batchSize; b++) {
        let sum = 0;
        for (let i = 0; i < LABELS.length; i++) {
          data[b * LABELS.length + i] = Math.random();
          sum += data[b * LABELS.length + i];
        }
        // Normalize to sum=1 (softmax-like)
        for (let i = 0; i < LABELS.length; i++) {
          data[b * LABELS.length + i] /= sum;
        }
        // Sometimes boost one class to simulate recognition
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
 * 2. Resize to 64×64
 * 3. Convert to grayscale + normalize [0,1]
 * 4. Return as 4D tensor [1, 64, 64, 1]
 */
export function preprocessCanvas(canvas) {
  return tf.tidy(() => {
    // Create an offscreen canvas at 64×64
    const offscreen = document.createElement("canvas");
    offscreen.width = 64;
    offscreen.height = 64;
    const ctx = offscreen.getContext("2d");

    // White background (drawings are on dark bg, we invert)
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, 64, 64);
    ctx.drawImage(canvas, 0, 0, 64, 64);

    const imageData = ctx.getImageData(0, 0, 64, 64);

    // Convert to grayscale tensor
    const data = new Float32Array(64 * 64);
    for (let i = 0; i < 64 * 64; i++) {
      const r = imageData.data[i * 4];
      const g = imageData.data[i * 4 + 1];
      const b = imageData.data[i * 4 + 2];
      // Grayscale + normalize
      data[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
    }

    return tf.tensor4d(data, [1, 64, 64, 1]);
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
