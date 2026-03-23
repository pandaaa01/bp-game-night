import { getRoom, serializeRoom } from "./roomManager.js";
import { getRandomWord } from "./words.js";

const BETWEEN_ROUND_DELAY = 5000; // 5 seconds between rounds

export function startRound(code, io) {
  const room = getRoom(code);
  if (!room) return;

  const word = getRandomWord(room.gameState.usedWords);
  room.gameState.currentWord = word;
  room.gameState.roundNumber++;
  room.gameState.status = "playing";
  room.gameState.roundStartTime = Date.now();
  room.gameState.scoredThisRound = new Set();
  room.gameState.usedWords.push(word);

  // Reset used words if we've gone through all of them
  if (room.gameState.usedWords.length >= 13) {
    room.gameState.usedWords = [word];
  }

  // Broadcast round start to all in room
  io.to(code).emit("round-start", {
    word,
    roundNumber: room.gameState.roundNumber,
    duration: room.gameState.roundDuration,
  });

  // Set up round end timer
  room.gameState.roundTimer = setTimeout(() => {
    endRound(code, io);
  }, room.gameState.roundDuration * 1000);
}

export function endRound(code, io) {
  const room = getRoom(code);
  if (!room) return;

  if (room.gameState.roundTimer) {
    clearTimeout(room.gameState.roundTimer);
    room.gameState.roundTimer = null;
  }

  room.gameState.status = "between-rounds";
  room.gameState.currentWord = null;

  const leaderboard = getLeaderboard(code);

  io.to(code).emit("round-end", {
    roundNumber: room.gameState.roundNumber,
    leaderboard,
    scoredPlayers: [...room.gameState.scoredThisRound],
  });

  // Auto-start next round after delay
  setTimeout(() => {
    const r = getRoom(code);
    if (r && r.gameState.status === "between-rounds") {
      const connectedPlayers = [...r.players.values()].filter(p => p.connected);
      if (connectedPlayers.length >= 1) {
        startRound(code, io);
      }
    }
  }, BETWEEN_ROUND_DELAY);
}

/**
 * Time-based scoring: faster correct answers earn more points.
 * - At 0s elapsed:  100 points (instant recognition)
 * - At 60s elapsed:  10 points (just barely in time)
 * - Linear interpolation between them
 */
function calculateTimeScore(roundStartTime, roundDuration) {
  const elapsed = (Date.now() - roundStartTime) / 1000; // seconds
  const fraction = Math.min(elapsed / roundDuration, 1);
  const MAX_SCORE = 100;
  const MIN_SCORE = 10;
  const score = Math.round(MAX_SCORE - (MAX_SCORE - MIN_SCORE) * fraction);
  return Math.max(MIN_SCORE, score);
}

export function submitScore(code, playerId, label, confidence) {
  const room = getRoom(code);
  if (!room) return { error: "Room not found" };
  if (room.gameState.status !== "playing") return { error: "No active round" };
  if (!room.players.has(playerId)) return { error: "Not a player" };
  if (room.gameState.scoredThisRound.has(playerId)) return { error: "Already scored this round" };

  const word = room.gameState.currentWord;

  if (label.toLowerCase() === word.toLowerCase() && confidence >= 0.80) {
    room.gameState.scoredThisRound.add(playerId);
    const player = room.players.get(playerId);
    const points = calculateTimeScore(room.gameState.roundStartTime, room.gameState.roundDuration);
    player.score += points;
    return { success: true, scored: true, label, confidence, points, playerScore: player.score };
  }

  return { success: true, scored: false, label, confidence };
}

export function getLeaderboard(code) {
  const room = getRoom(code);
  if (!room) return [];

  return [...room.players.values()]
    .map(p => ({ id: p.id, name: p.name, score: p.score, connected: p.connected }))
    .sort((a, b) => b.score - a.score);
}

export function startGame(code, io) {
  const room = getRoom(code);
  if (!room) return;

  room.gameState.status = "playing";
  room.gameState.roundNumber = 0;
  room.gameState.usedWords = [];

  // Reset all scores
  for (const player of room.players.values()) {
    player.score = 0;
  }

  io.to(code).emit("game-started", { room: serializeRoom(room) });

  startRound(code, io);
}
