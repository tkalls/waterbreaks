import { useEffect, useState } from "react";

export function WaterBreakTimer({ deadlineMs, locked }: { deadlineMs: number; locked: boolean }) {
  const [remaining, setRemaining] = useState(Math.max(0, deadlineMs - Date.now()));

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, deadlineMs - Date.now()));
    }, 250);
    return () => clearInterval(id);
  }, [deadlineMs]);

  const totalSecs = Math.ceil(remaining / 1000);
  const mm = String(Math.floor(totalSecs / 60)).padStart(2, "0");
  const ss = String(totalSecs % 60).padStart(2, "0");

  // Flat color-block swap as the window closes — no gradient.
  let block = "var(--yellow)";
  let fg = "var(--ink)";
  if (locked) {
    block = "var(--navy)";
    fg = "var(--paper)";
  } else if (totalSecs <= 15) {
    block = "var(--red)";
    fg = "var(--paper)";
  } else if (totalSecs <= 30) {
    block = "var(--orange)";
    fg = "var(--paper)";
  }

  return (
    <div
      className="wb-card wb-pop-in"
      style={{ background: block, color: fg, padding: "18px 24px", textAlign: "center" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
        {!locked && <span className="wb-live-dot" />}
        <span
          className="wb-tag"
          style={{ background: fg, color: block }}
        >
          {locked ? "Market Locked" : "Water Break Live"}
        </span>
      </div>
      <div
        className="wb-scoreboard-digits"
        style={{ fontSize: "clamp(48px, 12vw, 88px)", color: fg, lineHeight: 0.95 }}
      >
        {mm}:{ss}
      </div>
      <div style={{ fontFamily: "var(--wb-font-mono)", fontSize: 12, opacity: 0.8, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {locked ? "Predictions are closed for this round" : "Predictions close in"}
      </div>
    </div>
  );
}
