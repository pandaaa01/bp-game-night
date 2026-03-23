// Word list — must match the AI model's trained labels exactly
export const WORDS = [
  "cat",
  "dog",
  "house",
  "car",
  "tree",
  "fish",
  "bird",
  "star",
  "sun",
  "moon",
  "flower",
  "apple",
  "boat",
  "hat",
  "shoe",
  "clock",
  "key",
  "book",
  "cup",
  "heart"
];

export function getRandomWord(exclude = []) {
  const available = WORDS.filter(w => !exclude.includes(w));
  if (available.length === 0) return WORDS[Math.floor(Math.random() * WORDS.length)];
  return available[Math.floor(Math.random() * available.length)];
}
