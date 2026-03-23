import { useRef, useEffect, useCallback } from "react";

export default function SpectatorView({ socket, players, roomCode }) {
  const canvasRefs = useRef({});

  // Get or create canvas ref for a player
  const getCanvasRef = useCallback((playerId) => {
    return (el) => {
      if (el && !canvasRefs.current[playerId]) {
        canvasRefs.current[playerId] = el;
        // Initialize canvas
        const ctx = el.getContext("2d");
        el.width = el.offsetWidth * (window.devicePixelRatio || 1);
        el.height = el.offsetHeight * (window.devicePixelRatio || 1);
        ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
        ctx.fillStyle = "#0d0d1a";
        ctx.fillRect(0, 0, el.offsetWidth, el.offsetHeight);
      }
    };
  }, []);

  // Listen for draw strokes from players
  useEffect(() => {
    if (!socket) return;

    const handleStroke = ({ playerId, stroke }) => {
      const canvas = canvasRefs.current[playerId];
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      // Scale stroke coordinates to spectator canvas size
      // (strokes come in at the original player's dimensions)
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size * 0.5; // Scale down brush
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(stroke.from.x * (w / (stroke.canvasWidth || w)), stroke.from.y * (h / (stroke.canvasHeight || h)));
      ctx.lineTo(stroke.to.x * (w / (stroke.canvasWidth || w)), stroke.to.y * (h / (stroke.canvasHeight || h)));
      ctx.stroke();
    };

    const handleClear = ({ playerId }) => {
      const canvas = canvasRefs.current[playerId];
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#0d0d1a";
      ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    };

    socket.on("draw-stroke", handleStroke);
    socket.on("clear-canvas", handleClear);

    return () => {
      socket.off("draw-stroke", handleStroke);
      socket.off("clear-canvas", handleClear);
    };
  }, [socket]);

  // Clear canvases on new round
  useEffect(() => {
    if (!socket) return;

    const handleRoundStart = () => {
      Object.values(canvasRefs.current).forEach(canvas => {
        if (canvas) {
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#0d0d1a";
          ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
        }
      });
    };

    socket.on("round-start", handleRoundStart);
    return () => socket.off("round-start", handleRoundStart);
  }, [socket]);

  return (
    <div className="spectator-grid">
      {players.map(player => (
        <div key={player.id} className="spectator-card glass">
          <div className="spectator-card-header">
            <span className="name">{player.name}</span>
            <span className="score">{player.score} pts</span>
          </div>
          <canvas
            ref={getCanvasRef(player.id)}
            className="spectator-canvas"
          />
        </div>
      ))}
      {players.length === 0 && (
        <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
          No players are drawing yet...
        </div>
      )}
    </div>
  );
}
