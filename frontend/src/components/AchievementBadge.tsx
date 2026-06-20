export function AchievementBadge({ show, staked }: { show: boolean; staked: boolean }) {
  if (!show) return null;

  return (
    <div
      className="wb-pop-in"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 20px",
        borderRadius: "var(--wb-radius)",
        background: "var(--yellow)",
        color: "var(--ink)",
        border: "2px solid var(--ink)",
        boxShadow: "var(--wb-shadow-pop)",
      }}
    >
      <div style={{ fontSize: 36 }}>🏅</div>
      <div>
        <div className="wb-chrome-text" style={{ fontSize: 22 }}>PREDICTION MASTER</div>
        <div style={{ fontFamily: "var(--wb-font-mono)", fontSize: 12, opacity: 0.75 }}>
          {staked ? "Achievement unlocked · staked SOL and called it right" : "Achievement unlocked · called it right, free pick"}
        </div>
      </div>
    </div>
  );
}
