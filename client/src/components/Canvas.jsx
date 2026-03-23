import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from "react";

const COLORS = [
  "#ffffff", "#ef4444", "#f59e0b", "#10b981",
  "#06b6d4", "#7c3aed", "#ec4899", "#f97316"
];

const Canvas = forwardRef(function Canvas({ socket, roomCode, disabled }, ref) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef(null);
  const [brushSize, setBrushSize] = useState(4);
  const [brushColor, setBrushColor] = useState("#ffffff");

  // Expose the canvas element to parent
  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    clear: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#0d0d1a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }));

  // Resize canvas to fill container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const container = canvas.parentElement;
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#0d0d1a";
      ctx.fillRect(0, 0, rect.width, rect.height);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const getCanvasPoint = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const drawLine = useCallback((from, to, color, size) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }, []);

  const handleStart = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    isDrawing.current = true;
    lastPoint.current = getCanvasPoint(e);
  }, [disabled, getCanvasPoint]);

  const handleMove = useCallback((e) => {
    if (!isDrawing.current || disabled) return;
    e.preventDefault();
    const point = getCanvasPoint(e);
    const from = lastPoint.current;

    drawLine(from, point, brushColor, brushSize);

    // Emit stroke to server
    if (socket && roomCode) {
      socket.emit("draw-stroke", {
        code: roomCode,
        stroke: { from, to: point, color: brushColor, size: brushSize },
      });
    }

    lastPoint.current = point;
  }, [disabled, getCanvasPoint, drawLine, brushColor, brushSize, socket, roomCode]);

  const handleEnd = useCallback(() => {
    isDrawing.current = false;
    lastPoint.current = null;
  }, []);

  // Mouse events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("mousedown", handleStart);
    canvas.addEventListener("mousemove", handleMove);
    canvas.addEventListener("mouseup", handleEnd);
    canvas.addEventListener("mouseleave", handleEnd);

    // Touch events
    canvas.addEventListener("touchstart", handleStart, { passive: false });
    canvas.addEventListener("touchmove", handleMove, { passive: false });
    canvas.addEventListener("touchend", handleEnd);

    return () => {
      canvas.removeEventListener("mousedown", handleStart);
      canvas.removeEventListener("mousemove", handleMove);
      canvas.removeEventListener("mouseup", handleEnd);
      canvas.removeEventListener("mouseleave", handleEnd);
      canvas.removeEventListener("touchstart", handleStart);
      canvas.removeEventListener("touchmove", handleMove);
      canvas.removeEventListener("touchend", handleEnd);
    };
  }, [handleStart, handleMove, handleEnd]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(0, 0, rect.width, rect.height);
    if (socket && roomCode) {
      socket.emit("clear-canvas", { code: roomCode });
    }
  };

  return (
    <div className="game-canvas-area">
      <div className="canvas-container">
        <canvas ref={canvasRef} style={{ cursor: disabled ? "not-allowed" : "crosshair" }} />
      </div>
      {!disabled && (
        <div className="canvas-toolbar glass">
          {/* Color swatches */}
          {COLORS.map(color => (
            <div
              key={color}
              className={`color-swatch ${brushColor === color ? "active" : ""}`}
              style={{ background: color }}
              onClick={() => setBrushColor(color)}
            />
          ))}
          <div className="separator" />
          <div className="brush-size">
            <span>Size</span>
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={e => setBrushSize(Number(e.target.value))}
            />
          </div>
          <div className="separator" />
          <button className="btn btn-secondary btn-sm" onClick={handleClear}>🗑️ Clear</button>
        </div>
      )}
    </div>
  );
});

export default Canvas;
