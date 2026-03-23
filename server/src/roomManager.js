import { v4 as uuidv4 } from "uuid";

// In-memory room storage
const rooms = new Map();

const MAX_PLAYERS = 15;

function generateRoomCode() {
  return uuidv4().slice(0, 6).toUpperCase();
}

export function createRoom(hostId, hostName) {
  const code = generateRoomCode();
  const room = {
    code,
    hostId,
    players: new Map(),
    spectators: new Map(),
    gameState: {
      status: "waiting",  // waiting | playing | between-rounds
      currentWord: null,
      roundNumber: 0,
      roundDuration: 60,  // 60 seconds per round
      roundStartTime: null,
      roundTimer: null,
      scoredThisRound: new Set(),
      usedWords: [],
    },
    createdAt: Date.now(),
  };
  // Host is a spectator — they can view all drawings but don't draw
  room.spectators.set(hostId, { id: hostId, name: hostName, connected: true });
  rooms.set(code, room);
  return room;
}

export function joinRoom(code, playerId, playerName) {
  const room = rooms.get(code);
  if (!room) return { error: "Room not found" };
  if (room.players.size >= MAX_PLAYERS) return { error: "Room is full (max 15 players)" };
  if (room.players.has(playerId)) return { error: "Already in room" };
  if (room.spectators.has(playerId)) return { error: "Already in room as spectator" };

  room.players.set(playerId, { id: playerId, name: playerName, score: 0, connected: true });
  return { room };
}

export function joinAsSpectator(code, socketId, name) {
  const room = rooms.get(code);
  if (!room) return { error: "Room not found" };

  room.spectators.set(socketId, { id: socketId, name, connected: true });
  return { room };
}

export function removePlayer(code, socketId) {
  const room = rooms.get(code);
  if (!room) return null;

  if (room.players.has(socketId)) {
    room.players.get(socketId).connected = false;
    // If all players disconnected, clean up room after 60s
    const allDisconnected = [...room.players.values()].every(p => !p.connected);
    if (allDisconnected) {
      setTimeout(() => {
        const r = rooms.get(code);
        if (r && [...r.players.values()].every(p => !p.connected)) {
          if (r.gameState.roundTimer) clearTimeout(r.gameState.roundTimer);
          rooms.delete(code);
        }
      }, 60000);
    }
  }

  if (room.spectators.has(socketId)) {
    room.spectators.delete(socketId);
  }

  return room;
}

export function reconnectPlayer(code, socketId, playerName) {
  const room = rooms.get(code);
  if (!room) return null;

  for (const [id, player] of room.players) {
    if (player.name === playerName && !player.connected) {
      room.players.delete(id);
      player.id = socketId;
      player.connected = true;
      room.players.set(socketId, player);
      return room;
    }
  }
  return null;
}

export function getRoom(code) {
  return rooms.get(code) || null;
}

export function listRooms() {
  const list = [];
  for (const [code, room] of rooms) {
    list.push({
      code,
      playerCount: room.players.size,
      spectatorCount: room.spectators.size,
      status: room.gameState.status,
      maxPlayers: MAX_PLAYERS,
    });
  }
  return list;
}

export function serializeRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    players: [...room.players.values()].map(p => ({
      id: p.id, name: p.name, score: p.score, connected: p.connected
    })),
    spectators: [...room.spectators.values()].map(s => ({
      id: s.id, name: s.name
    })),
    gameState: {
      status: room.gameState.status,
      currentWord: room.gameState.currentWord,
      roundNumber: room.gameState.roundNumber,
      roundDuration: room.gameState.roundDuration,
      roundStartTime: room.gameState.roundStartTime,
      scoredThisRound: [...room.gameState.scoredThisRound],
    },
  };
}
