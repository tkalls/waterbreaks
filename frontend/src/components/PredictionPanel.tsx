import type { OptionKey, RoundState } from "../lib/mockData";

const STAKE_SOL = 0.1;
const BLOCKS = ["var(--yellow)", "var(--orange)", "var(--lavender)"];

export function PredictionPanel({
  round,
  locked,
  walletConnected,
  pendingTx,
  freePick,
  onFreePick,
  myBetOption,
  onPlaceBet,
}: {
  round: RoundState;
  locked: boolean;
  walletConnected: boolean;
  pendingTx: boolean;
  freePick: OptionKey | null;
  onFreePick: (option: OptionKey) => void;
  myBetOption: OptionKey | null;
  onPlaceBet: (option: OptionKey) => void;
}) {
  const staked = myBetOption !== null;

  return (
    <div className="wb-card wb-pop-in" style={{ padding: "20px 22px" }}>
      <div style={{ fontFamily: "var(--wb-font-mono)", fontSize: 11, opacity: 0.8, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {freePick === null ? "Pick your prediction — free, no wallet needed" : "Your prediction"}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {round.options.map((label, i) => {
          const option = i as OptionKey;
          const isFreePick = freePick === option;
          const dimmed = freePick !== null && !isFreePick;
          return (
            <button
              key={label}
              disabled={locked || freePick !== null}
              onClick={() => onFreePick(option)}
              className="wb-btn"
              style={{
                textAlign: "left",
                background: isFreePick ? "var(--ink)" : BLOCKS[i % BLOCKS.length],
                color: isFreePick ? "var(--paper)" : "var(--ink)",
                opacity: dimmed ? 0.4 : 1,
                fontSize: 16,
              }}
            >
              {isFreePick ? (staked ? "✦ STAKED · " : "✦ ") : ""}
              {label}
            </button>
          );
        })}
      </div>

      {freePick !== null && !staked && (
        <>
          <button
            className="wb-btn"
            disabled={!walletConnected || locked || pendingTx}
            onClick={() => onPlaceBet(freePick)}
            style={{ width: "100%", marginTop: 16, background: "var(--orange)", color: "var(--paper)" }}
          >
            {pendingTx
              ? "Confirming on Solana..."
              : !walletConnected
                ? "Connect Phantom to back this with SOL"
                : locked
                  ? "Predictions closed"
                  : `Back it with ${STAKE_SOL} SOL`}
          </button>
          <div style={{ fontFamily: "var(--wb-font-mono)", fontSize: 11, opacity: 0.7, textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
            Optional. Your prediction already counts — this just puts real SOL behind it for the payout leaderboard.
          </div>
        </>
      )}

      {staked && (
        <div
          className="wb-btn"
          style={{ width: "100%", marginTop: 16, textAlign: "center", cursor: "default", background: "var(--red)", color: "var(--paper)" }}
        >
          ✦ Backed with {STAKE_SOL} SOL
        </div>
      )}
    </div>
  );
}
