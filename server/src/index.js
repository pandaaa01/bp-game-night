import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

import {
  createRoom, joinRoom, joinAsSpectator,
  removePlayer, getRoom, listRooms, serializeRoom,
} from "./roomManager.js";
import {
  startGame, startRound, submitScore, getLeaderboard,
} from "./gameManager.js";

const PORT = process.env.PORT || 3001;

// Support multiple origins via comma-separated CLIENT_URL
// e.g. CLIENT_URL=https://drawbattle.vercel.app,https://drawbattle-git-main.vercel.app
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const allowedOrigins = CLIENT_URL.split(",").map(s => s.trim());

function corsOrigin(origin, callback) {
  // Allow requests with no origin (mobile apps, curl, etc.)
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
    return callback(null, true);
  }
  // In production, be strict. In dev, allow all.
  if (process.env.NODE_ENV !== "production") return callback(null, true);
  callback(new Error("Not allowed by CORS"));
}

const app = express();
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
  },
  // Render free tier can be slow to wake — increase timeouts
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ─── Room Management ──────────────────────────────────────────
  socket.on("list-rooms", (callback) => {
    callback(listRooms());
  });

  socket.on("create-room", ({ playerName }, callback) => {
    const room = createRoom(socket.id, playerName);
    socket.join(room.code);
    callback({ success: true, room: serializeRoom(room) });
    io.emit("rooms-updated", listRooms());
    console.log(`[room] ${playerName} created room ${room.code}`);
  });

  socket.on("join-room", ({ code, playerName }, callback) => {
    const result = joinRoom(code, socket.id, playerName);
    if (result.error) {
      callback({ success: false, error: result.error });
      return;
    }
    socket.join(code);
    const serialized = serializeRoom(result.room);
    callback({ success: true, room: serialized });
    socket.to(code).emit("player-joined", {
      player: { id: socket.id, name: playerName, score: 0 },
      room: serialized,
    });
    io.emit("rooms-updated", listRooms());
    console.log(`[room] ${playerName} joined room ${code}`);
  });

  socket.on("join-spectator", ({ code, spectatorName }, callback) => {
    const result = joinAsSpectator(code, socket.id, spectatorName);
    if (result.error) {
      callback({ success: false, error: result.error });
      return;
    }
    socket.join(code);
    const serialized = serializeRoom(result.room);
    callback({ success: true, room: serialized });
    socket.to(code).emit("spectator-joined", {
      spectator: { id: socket.id, name: spectatorName },
      room: serialized,
    });
    io.emit("rooms-updated", listRooms());
    console.log(`[room] ${spectatorName} joined room ${code} as spectator`);
  });

  // ─── Game Controls ────────────────────────────────────────────
  socket.on("start-game", ({ code }) => {
    const room = getRoom(code);
    if (!room) return;
    if (room.hostId !== socket.id) return; // only host can start
    startGame(code, io);
    io.emit("rooms-updated", listRooms());
    console.log(`[game] Game started in room ${code}`);
  });

  // ─── Drawing ──────────────────────────────────────────────────
  socket.on("draw-stroke", ({ code, stroke }) => {
    // Relay drawing strokes to all others in room (spectators + players)
    socket.to(code).emit("draw-stroke", {
      playerId: socket.id,
      stroke,
    });
  });

  socket.on("clear-canvas", ({ code }) => {
    socket.to(code).emit("clear-canvas", { playerId: socket.id });
  });

  // ─── AI Scoring ───────────────────────────────────────────────
  socket.on("submit-score", ({ code, label, confidence }, callback) => {
    const result = submitScore(code, socket.id, label, confidence);
    if (result.error) {
      callback({ success: false, error: result.error });
      return;
    }

    callback(result);

    if (result.scored) {
      const leaderboard = getLeaderboard(code);
      io.to(code).emit("score-update", {
        playerId: socket.id,
        leaderboard,
        label,
        confidence,
      });
      console.log(`[score] Player ${socket.id} scored in room ${code} (${label} @ ${(confidence * 100).toFixed(1)}%)`);
    }
  });

  // ─── Disconnect ───────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`[disconnect] ${socket.id}`);
    // Find and remove from all rooms this socket was in
    for (const roomCode of socket.rooms) {
      if (roomCode === socket.id) continue; // skip default room
      const room = removePlayer(roomCode, socket.id);
      if (room) {
        io.to(roomCode).emit("player-left", {
          playerId: socket.id,
          room: serializeRoom(room),
        });
      }
    }
    io.emit("rooms-updated", listRooms());
  });
});

httpServer.listen(PORT, () => {
  console.log(`🎮 DrawBattle server running on port ${PORT}`);
});
