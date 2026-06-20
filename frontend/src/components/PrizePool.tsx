import type { RoundState } from "../lib/mockData";

export function PrizePool({ round }: { round: RoundState }) {
  return (
    <div
      className="wb-card wb-pop-in"
      style={{ background: "var(--paper)", color: "var(--ink)", padding: 0, overflow: "hidden" }}
    >
      {/* ticket header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "12px 20px 10px",
          fontFamily: "var(--wb-font-mono)",
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        <span>Prize Pool</span>
        <span>Round #{round.roundId} · Devnet</span>
      </div>

      {/* perforated divider */}
      <div style={{ borderTop: "2px dashed var(--ink)", margin: "0 14px" }} />

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          padding: "14px 20px 6px",
          flexWrap: "wrap",
        }}
      >
        <div className="wb-chrome-text" style={{ fontSize: "clamp(40px, 9vw, 68px)", color: "var(--ink)" }}>
          {round.totalPoolSol.toFixed(2)}
          <span style={{ fontSize: "0.4em", marginLeft: 8 }}>SOL</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "var(--wb-font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.7 }}>
            Fans in
          </div>
          <div className="wb-scoreboard-digits" style={{ fontSize: 30 }}>
            {round.participantCount}
          </div>
        </div>
      </div>

      {/* barcode strip */}
      <div className="wb-stripes" style={{ height: 26, margin: "8px 20px 16px" }} />
    </div>
  );
}
