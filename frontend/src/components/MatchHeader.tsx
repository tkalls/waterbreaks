import type { RoundState } from "../lib/mockData";

export function MatchHeader({ round }: { round: RoundState }) {
  return (
    <div
      className="wb-card wb-pop-in"
      style={{
        background: "var(--navy)",
        color: "var(--paper)",
        padding: "20px 22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="wb-tag" style={{ background: "var(--lavender)", color: "var(--ink)" }}>
          World Cup · Round of 16
        </span>
        <div
          className="wb-chrome-text"
          style={{ fontSize: "clamp(30px, 7vw, 58px)", color: "var(--paper)" }}
        >
          {round.teamA.toUpperCase()}
          <span style={{ color: "var(--yellow)" }}> ✦ </span>
          {round.teamB.toUpperCase()}
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "var(--wb-font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.7 }}>
          Match clock
        </div>
        <div className="wb-scoreboard-digits" style={{ fontSize: 26, color: "var(--yellow)" }}>
          {round.matchClock}
        </div>
      </div>
    </div>
  );
}
