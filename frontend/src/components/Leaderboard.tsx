import type { LeaderboardEntry } from "../lib/mockData";
import { shortWallet } from "../lib/mockData";

const MEDALS = ["🥇", "🥈", "🥉"];

export function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="wb-card wb-pop-in" style={{ padding: "20px 24px" }}>
      <div className="wb-chrome-text" style={{ fontSize: 22, marginBottom: 12 }}>
        🏆 Winners
      </div>
      {entries.map((entry, i) => (
        <div
          key={entry.wallet}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 0",
            fontFamily: "var(--wb-font-mono)",
            borderBottom: i < entries.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
          }}
        >
          <span>
            {MEDALS[i] ?? `${i + 1}.`} {shortWallet(entry.wallet)}
          </span>
          <span style={{ color: "var(--wb-yellow)", fontWeight: 700 }}>+{entry.payoutSol.toFixed(2)} SOL</span>
        </div>
      ))}
    </div>
  );
}
