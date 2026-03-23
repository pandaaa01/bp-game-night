// Word list — must match the AI model's trained labels exactly (alphabetical order)
export const WORDS = [
  "apple",
  "bowtie",
  "candle",
  "door",
  "envelope",
  "fish",
  "guitar",
  "ice cream",
  "lightning",
  "moon",
  "mountain",
  "star",
  "tent",
  "toothbrush",
  "wristwatch"
];

export function getRandomWord(exclude = []) {
  const available = WORDS.filter(w => !exclude.includes(w));
  if (available.length === 0) return WORDS[Math.floor(Math.random() * WORDS.length)];
  return available[Math.floor(Math.random() * available.length)];
}
