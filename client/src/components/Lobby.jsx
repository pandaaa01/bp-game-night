import { useState, useEffect, useCallback } from "react";

export default function Lobby({ socket, onJoinRoom }) {
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinMode, setJoinMode] = useState("player"); // "player" | "spectator"
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    socket.emit("list-rooms", (roomList) => setRooms(roomList));

    const handleRoomsUpdated = (roomList) => setRooms(roomList);
    socket.on("rooms-updated", handleRoomsUpdated);
    return () => socket.off("rooms-updated", handleRoomsUpdated);
  }, [socket]);

  const handleCreate = useCallback(() => {
    if (!playerName.trim()) { setError("Enter your name first!"); return; }
    setLoading(true); setError("");
    socket.emit("create-room", { playerName: playerName.trim() }, (res) => {
      setLoading(false);
      if (res.success) {
        onJoinRoom(res.room, "spectator"); // Host is spectator — views all drawings
      } else {
        setError(res.error || "Failed to create room");
      }
    });
  }, [socket, playerName, onJoinRoom]);

  const handleJoin = useCallback((code) => {
    const c = (code || roomCode).trim().toUpperCase();
    if (!playerName.trim()) { setError("Enter your name first!"); return; }
    if (!c) { setError("Enter a room code!"); return; }
    setLoading(true); setError("");

    const event = joinMode === "spectator" ? "join-spectator" : "join-room";
    const payload = joinMode === "spectator"
      ? { code: c, spectatorName: playerName.trim() }
      : { code: c, playerName: playerName.trim() };

    socket.emit(event, payload, (res) => {
      setLoading(false);
      if (res.success) {
        onJoinRoom(res.room, joinMode);
      } else {
        setError(res.error || "Failed to join room");
      }
    });
  }, [socket, playerName, roomCode, joinMode, onJoinRoom]);

  return (
    <div className="lobby">
      <div className="lobby-hero">
        <h1>DrawBattle</h1>
        <p>Draw it. Let the AI judge. Outscore your friends in this fast-paced multiplayer drawing showdown.</p>
      </div>

      {error && (
        <div className="ai-message fail" style={{ position: "static", animation: "slideUp 0.3s ease", pointerEvents: "auto" }}>
          {error}
        </div>
      )}

      <div className="lobby-actions">
        {/* Create Room Card */}
        <div className="lobby-card glass glass-hover">
          <h2><span className="icon">🎮</span> Create Room</h2>
          <input
            id="name-input-create"
            className="lobby-input"
            type="text"
            placeholder="Your name..."
            value={playerName}
            onChange={e => { setPlayerName(e.target.value); setError(""); }}
            maxLength={20}
          />
          <button
            id="create-room-btn"
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={loading || !playerName.trim()}
          >
            {loading ? "Creating..." : "⚡ Create Room"}
          </button>
        </div>

        {/* Join Room Card */}
        <div className="lobby-card glass glass-hover">
          <h2><span className="icon">🚪</span> Join Room</h2>
          <input
            id="name-input-join"
            className="lobby-input"
            type="text"
            placeholder="Your name..."
            value={playerName}
            onChange={e => { setPlayerName(e.target.value); setError(""); }}
            maxLength={20}
          />
          <input
            id="room-code-input"
            className="lobby-input"
            type="text"
            placeholder="Room code (e.g. A1B2C3)"
            value={roomCode}
            onChange={e => setRoomCode(e.target.value.toUpperCase())}
            maxLength={6}
            style={{ fontFamily: "var(--font-display)", letterSpacing: "0.1em", fontWeight: 700 }}
          />
          <div className="join-mode-toggle">
            <button className={joinMode === "player" ? "active" : ""} onClick={() => setJoinMode("player")}>
              🎨 Player
            </button>
            <button className={joinMode === "spectator" ? "active" : ""} onClick={() => setJoinMode("spectator")}>
              👁️ Spectator
            </button>
          </div>
          <button
            id="join-room-btn"
            className="btn btn-primary"
            onClick={() => handleJoin()}
            disabled={loading || !playerName.trim() || !roomCode.trim()}
          >
            {loading ? "Joining..." : joinMode === "spectator" ? "👁️ Watch Game" : "🎨 Join Game"}
          </button>
        </div>
      </div>

      {/* Available Rooms */}
      {rooms.length > 0 && (
        <div className="rooms-list">
          <h3>Available Rooms</h3>
          {rooms.map(room => (
            <div
              key={room.code}
              className="room-item glass glass-hover"
              onClick={() => { setRoomCode(room.code); if (playerName.trim()) handleJoin(room.code); }}
            >
              <div className="room-info">
                <span className="room-code">{room.code}</span>
                <div className="room-meta">
                  <span>👥 {room.playerCount}/{room.maxPlayers}</span>
                  <span>👁️ {room.spectatorCount}</span>
                  <span style={{
                    color: room.status === "playing" ? "var(--accent-success)" : "var(--accent-warning)"
                  }}>
                    {room.status === "waiting" ? "⏳ Waiting" : room.status === "playing" ? "🎮 Playing" : "🔄 Between rounds"}
                  </span>
                </div>
              </div>
              <button className="btn btn-secondary btn-sm">Join →</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
