import { useState, useEffect, useRef, useCallback } from "react";
import Canvas from "./Canvas";
import Timer from "./Timer";
import Leaderboard from "./Leaderboard";
import SpectatorView from "./SpectatorView";
import AIMessages, { createMessage } from "./AIMessages";
import { loadModel, preprocessCanvas, predict, getRandomFailMessage, getRandomSuccessMessage } from "../lib/ai";

export default function Game({ socket, room: initialRoom, role, onLeave }) {
  const [room, setRoom] = useState(initialRoom);
  const [gameStatus, setGameStatus] = useState(initialRoom.gameState.status);
  const [currentWord, setCurrentWord] = useState(initialRoom.gameState.currentWord);
  const [roundNumber, setRoundNumber] = useState(initialRoom.gameState.roundNumber);
  const [roundDuration, setRoundDuration] = useState(initialRoom.gameState.roundDuration);
  const [roundStartTime, setRoundStartTime] = useState(initialRoom.gameState.roundStartTime);
  const [scoredThisRound, setScoredThisRound] = useState(initialRoom.gameState.scoredThisRound || []);
  const [players, setPlayers] = useState(initialRoom.players);
  const [spectators, setSpectators] = useState(initialRoom.spectators);
  const [aiMessages, setAiMessages] = useState([]);
  const [hasScored, setHasScored] = useState(false);
  const [modelReady, setModelReady] = useState(false);

  const canvasRef = useRef(null);
  const modelRef = useRef(null);
  const inferenceTimer = useRef(null);

  const isPlayer = role === "player";
  const isHost = socket.id === room.hostId;

  // Load AI model on mount (players only)
  useEffect(() => {
    if (!isPlayer) return;
    loadModel().then(m => {
      modelRef.current = m;
      setModelReady(true);
      const isMock = m._isMock;
      addAiMessage(
        isMock ? "🤖 AI running in mock mode (no model loaded)" : "🤖 AI model loaded and ready!",
        "info"
      );
    });
  }, [isPlayer]);

  // Clean up AI messages after 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setAiMessages(msgs => msgs.filter(m => Date.now() - m.timestamp < 3000));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const addAiMessage = useCallback((text, type) => {
    setAiMessages(msgs => [...msgs.slice(-3), createMessage(text, type)]);
  }, []);

  // ─── Socket Event Listeners ─────────────────────────────────
  useEffect(() => {
    const handleRoundStart = ({ word, roundNumber: rn, duration }) => {
      setCurrentWord(word);
      setRoundNumber(rn);
      setRoundDuration(duration);
      setRoundStartTime(Date.now());
      setGameStatus("playing");
      setHasScored(false);
      setScoredThisRound([]);

      // Clear canvas
      if (canvasRef.current) canvasRef.current.clear();

      addAiMessage(`Round ${rn} — Draw: "${word}"`, "info");
    };

    const handleRoundEnd = ({ leaderboard, scoredPlayers }) => {
      setGameStatus("between-rounds");
      setCurrentWord(null);
      setScoredThisRound(scoredPlayers);
      if (leaderboard) {
        setPlayers(prev => {
          const map = new Map(leaderboard.map(p => [p.id, p]));
          return prev.map(p => map.has(p.id) ? { ...p, ...map.get(p.id) } : p);
        });
      }
    };

    const handleGameStarted = ({ room: newRoom }) => {
      setRoom(newRoom);
      setPlayers(newRoom.players);
      setSpectators(newRoom.spectators);
      setGameStatus("playing");
    };

    const handleScoreUpdate = ({ leaderboard }) => {
      if (leaderboard) {
        setPlayers(prev => {
          const map = new Map(leaderboard.map(p => [p.id, p]));
          return prev.map(p => map.has(p.id) ? { ...p, ...map.get(p.id) } : p);
        });
        setScoredThisRound(leaderboard.filter(p => p.score > 0).map(p => p.id));
      }
    };

    const handlePlayerJoined = ({ player, room: updated }) => {
      setPlayers(updated.players);
      setSpectators(updated.spectators);
    };

    const handlePlayerLeft = ({ room: updated }) => {
      setPlayers(updated.players);
      setSpectators(updated.spectators);
    };

    const handleSpectatorJoined = ({ room: updated }) => {
      setSpectators(updated.spectators);
    };

    socket.on("round-start", handleRoundStart);
    socket.on("round-end", handleRoundEnd);
    socket.on("game-started", handleGameStarted);
    socket.on("score-update", handleScoreUpdate);
    socket.on("player-joined", handlePlayerJoined);
    socket.on("player-left", handlePlayerLeft);
    socket.on("spectator-joined", handleSpectatorJoined);

    return () => {
      socket.off("round-start", handleRoundStart);
      socket.off("round-end", handleRoundEnd);
      socket.off("game-started", handleGameStarted);
      socket.off("score-update", handleScoreUpdate);
      socket.off("player-joined", handlePlayerJoined);
      socket.off("player-left", handlePlayerLeft);
      socket.off("spectator-joined", handleSpectatorJoined);
    };
  }, [socket, addAiMessage]);

  // ─── AI Inference Loop (every 3 seconds) ────────────────────
  useEffect(() => {
    if (!isPlayer || !modelReady || gameStatus !== "playing" || hasScored) {
      if (inferenceTimer.current) {
        clearInterval(inferenceTimer.current);
        inferenceTimer.current = null;
      }
      return;
    }

    inferenceTimer.current = setInterval(async () => {
      if (!canvasRef.current || !modelRef.current || hasScored) return;

      const canvas = canvasRef.current.getCanvas();
      if (!canvas) return;

      try {
        const tensor = preprocessCanvas(canvas);
        const result = await predict(modelRef.current, tensor);
        tensor.dispose();

        // Submit to server
        socket.emit("submit-score", {
          code: room.code,
          label: result.label,
          confidence: result.confidence,
        }, (res) => {
          if (res.scored) {
            setHasScored(true);
            addAiMessage(
              `${getRandomSuccessMessage()} +${res.points} pts! (${result.label} @ ${(result.confidence * 100).toFixed(0)}%)`,
              "success"
            );
          } else {
            addAiMessage(
              `${getRandomFailMessage()} (AI sees: "${result.label}" @ ${(result.confidence * 100).toFixed(0)}%)`,
              "fail"
            );
          }
        });
      } catch (err) {
        console.error("[AI] Inference error:", err);
      }
    }, 3000);

    return () => {
      if (inferenceTimer.current) {
        clearInterval(inferenceTimer.current);
        inferenceTimer.current = null;
      }
    };
  }, [isPlayer, modelReady, gameStatus, hasScored, socket, room.code, addAiMessage]);

  // ─── Handle Start Game ──────────────────────────────────────
  const handleStartGame = () => {
    socket.emit("start-game", { code: room.code });
  };

  const handleLeaveRoom = () => {
    onLeave();
  };

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="game">
      {/* HUD Bar */}
      <div className="game-hud glass">
        <div className="game-status">
          <span className="round-badge">Round {roundNumber || 0}</span>
          <span>Room: <strong style={{ color: "var(--accent-secondary)", letterSpacing: "0.1em" }}>{room.code}</strong></span>
          <span>
            {isPlayer ? "🎨 Player" : "👁️ Spectator"}
            {isHost && " (Host)"}
          </span>
        </div>
        <div className="game-word">
          {currentWord ? (
            <>
              <div className="label">{isPlayer ? "Draw this" : "Word"}</div>
              <div className="word">{currentWord}</div>
            </>
          ) : (
            <div className="label">{gameStatus === "waiting" ? "WAITING TO START..." : "Next round starting..."}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {hasScored && <span style={{ color: "var(--accent-success)", fontWeight: 600 }}>✅ Scored!</span>}
          <button className="btn btn-danger btn-sm" onClick={handleLeaveRoom}>Leave</button>
        </div>
      </div>

      {/* Waiting / Between Rounds / Playing */}
      {gameStatus === "waiting" ? (
        <div className="waiting-screen">
          <h2>Waiting for players...</h2>
          <div className="room-code-display" onClick={() => navigator.clipboard.writeText(room.code)} title="Click to copy">
            {room.code}
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Share this code with friends!</p>
          <div className="player-list">
            {players.map(p => (
              <div key={p.id} className="player-chip">
                {p.name}
                {p.id === room.hostId && <span className="host-badge">Host</span>}
              </div>
            ))}
            {spectators.map(s => (
              <div key={s.id} className="player-chip">
                {s.name}
                <span className="spectator-tag">SPECTATOR</span>
              </div>
            ))}
          </div>
          {isHost && players.length >= 1 && (
            <button className="btn btn-primary" onClick={handleStartGame}>
              ⚡ Start Game ({players.length} player{players.length > 1 ? "s" : ""})
            </button>
          )}
          {!isHost && <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>Waiting for host to start...</p>}
        </div>
      ) : gameStatus === "between-rounds" ? (
        <div className="waiting-screen">
          <div className="between-rounds">
            <h2>Round {roundNumber} Complete!</h2>
            <p className="next-label">Next round starting soon...</p>
          </div>
          <Leaderboard
            players={players}
            spectators={spectators}
            scoredThisRound={scoredThisRound}
            myId={socket.id}
          />
        </div>
      ) : (
        <>
          {/* Main Game Area */}
          {isPlayer ? (
            <Canvas
              ref={canvasRef}
              socket={socket}
              roomCode={room.code}
              disabled={hasScored}
            />
          ) : (
            <SpectatorView
              socket={socket}
              players={players}
              roomCode={room.code}
            />
          )}

          {/* Sidebar */}
          <div className="game-sidebar">
            <Timer
              duration={roundDuration}
              startTime={roundStartTime}
              status={gameStatus}
            />
            <Leaderboard
              players={players}
              spectators={spectators}
              scoredThisRound={scoredThisRound}
              myId={socket.id}
            />
          </div>
        </>
      )}

      {/* AI Messages */}
      <AIMessages messages={aiMessages} />
    </div>
  );
}
