export default function Leaderboard({ players, spectators, scoredThisRound, myId }) {
  const getRankClass = (index) => {
    if (index === 0) return "gold";
    if (index === 1) return "silver";
    if (index === 2) return "bronze";
    return "other";
  };

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="leaderboard glass">
      <h3>🏆 Leaderboard</h3>
      {sortedPlayers.map((player, index) => {
        const scored = scoredThisRound?.includes(player.id);
        const isMe = player.id === myId;
        return (
          <div
            key={player.id}
            className={`leaderboard-item ${scored ? "scored" : ""}`}
            style={isMe ? { background: "rgba(124, 58, 237, 0.08)", borderLeft: "3px solid var(--accent-primary)" } : {}}
          >
            <div className={`leaderboard-rank ${getRankClass(index)}`}>
              {index + 1}
            </div>
            <span className={`leaderboard-name ${!player.connected ? "disconnected" : ""}`}>
              {player.name}
              {isMe && <span style={{ color: "var(--accent-primary)", fontSize: "0.75rem", marginLeft: 4 }}>(you)</span>}
              {scored && <span style={{ color: "var(--accent-success)", fontSize: "0.75rem", marginLeft: 4 }}>✓</span>}
            </span>
            <span className={`leaderboard-score ${scored ? "animate" : ""}`}>
              {player.score}
            </span>
          </div>
        );
      })}

      {spectators && spectators.length > 0 && (
        <>
          <h3 style={{ marginTop: 20 }}>👁️ Spectators</h3>
          {spectators.map(spec => (
            <div key={spec.id} className="leaderboard-item">
              <span className="spectator-tag">SPEC</span>
              <span className="leaderboard-name">{spec.name}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
