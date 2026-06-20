import type { ActivityItem, RoundState } from "../lib/mockData";
import { shortWallet } from "../lib/mockData";

export function ActivityFeed({ items, round }: { items: ActivityItem[]; round: RoundState }) {
  return (
    <div className="wb-card wb-pop-in" style={{ padding: "20px 24px", maxHeight: 220, overflowY: "auto" }}>
      <div style={{ fontFamily: "var(--wb-font-mono)", fontSize: 12, opacity: 0.7, marginBottom: 10, textTransform: "uppercase" }}>
        Live activity
      </div>
      {items.slice(0, 8).map((item) => (
        <div
          key={item.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            fontFamily: "var(--wb-font-mono)",
            padding: "6px 0",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <span>
            {shortWallet(item.wallet)} joined <strong>{round.options[item.option]}</strong>
          </span>
          <span style={{ opacity: 0.5 }}>{timeAgo(item.ts)}</span>
        </div>
      ))}
    </div>
  );
}

function timeAgo(ts: number) {
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  return secs < 1 ? "now" : `${secs}s ago`;
}
