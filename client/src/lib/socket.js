import { io } from "socket.io-client";

// When deployed together (same origin), no URL needed — socket.io connects to window.origin
// Only set VITE_SERVER_URL if the backend is on a different domain
const SERVER_URL = import.meta.env.VITE_SERVER_URL || undefined;

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
