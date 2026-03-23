import { useState, useEffect, useCallback } from "react";
import "./App.css";
import { connectSocket } from "./lib/socket";
import Lobby from "./components/Lobby";
import Game from "./components/Game";

function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [view, setView] = useState("lobby"); // "lobby" | "game"
  const [room, setRoom] = useState(null);
  const [role, setRole] = useState("player"); // "player" | "spectator"

  // Connect socket on mount
  useEffect(() => {
    const s = connectSocket();
    setSocket(s);

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));

    return () => {
      s.off("connect");
      s.off("disconnect");
    };
  }, []);

  const handleJoinRoom = useCallback((roomData, playerRole) => {
    setRoom(roomData);
    setRole(playerRole);
    setView("game");
  }, []);

  const handleLeave = useCallback(() => {
    setRoom(null);
    setView("lobby");
  }, []);

  if (!socket) {
    return (
      <div className="app">
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>🎮</div>
            <div style={{ color: "var(--text-secondary)" }}>Connecting...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          DrawBattle
          <span>AI Drawing Game</span>
        </div>
        <div className="connection-status">
          <div className={`status-dot ${connected ? "connected" : ""}`} />
          {connected ? "Connected" : "Reconnecting..."}
        </div>
      </header>

      {/* Views */}
      {view === "lobby" ? (
        <Lobby socket={socket} onJoinRoom={handleJoinRoom} />
      ) : (
        <Game
          key={room?.code}
          socket={socket}
          room={room}
          role={role}
          onLeave={handleLeave}
        />
      )}
    </div>
  );
}

export default App;
