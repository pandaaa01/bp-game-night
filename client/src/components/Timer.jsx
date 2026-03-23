import { useState, useEffect } from "react";

export default function Timer({ duration, startTime, status }) {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (status !== "playing" || !startTime) {
      setTimeLeft(duration);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(Math.ceil(remaining));
    }, 100);

    return () => clearInterval(interval);
  }, [duration, startTime, status]);

  const progress = duration > 0 ? timeLeft / duration : 0;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference * (1 - progress);

  const getStrokeColor = () => {
    if (progress > 0.5) return "var(--accent-success)";
    if (progress > 0.2) return "var(--accent-warning)";
    return "var(--accent-danger)";
  };

  const timerClass = progress <= 0.2 ? "danger" : progress <= 0.5 ? "warning" : "";

  return (
    <div className="timer-container">
      <div className={`timer-ring ${timerClass}`}>
        <svg viewBox="0 0 96 96">
          <circle className="bg-ring" cx="48" cy="48" r="42" />
          <circle
            className="progress-ring"
            cx="48" cy="48" r="42"
            stroke={getStrokeColor()}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="time-text">{timeLeft}</div>
      </div>
    </div>
  );
}
