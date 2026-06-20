import type { RoundState } from "../lib/mockData";

const COLORS = ["var(--wb-yellow)", "var(--wb-blue)", "var(--wb-pink)"];

export function CommunityStats({ round }: { round: RoundState }) {
  const total = round.optionPoolsSol.reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="wb-card wb-pop-in" style={{ padding: "20px 24px" }}>
      <div style={{ fontFamily: "var(--wb-font-mono)", fontSize: 12, opacity: 0.7, marginBottom: 10, textTransform: "uppercase" }}>
        Community predictions
      </div>
      {round.options.map((label, i) => {
        const pct = Math.round((round.optionPoolsSol[i] / total) * 100);
        return (
          <div key={label} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
              <span>{label}</span>
              <span className="wb-scoreboard-digits">{pct}%</span>
            </div>
            <div className="wb-progress-track">
              <div className="wb-progress-fill" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
