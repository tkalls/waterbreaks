import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import {
  initialActivity,
  initialMockRound,
  mockLeaderboard,
  randomFakeWallet,
  type ActivityItem,
  type OptionKey,
  type RoundState,
} from "./lib/mockData";
import { placeBetFallback, placeBetOnChain, fetchOnChainRound, roundAccountToState, PLACE_BET_MODE } from "./lib/program";

import { MatchHeader } from "./components/MatchHeader";
import { WaterBreakTimer } from "./components/WaterBreakTimer";
import { PredictionPanel } from "./components/PredictionPanel";
import { CommunityStats } from "./components/CommunityStats";
import { ActivityFeed } from "./components/ActivityFeed";
import { PrizePool } from "./components/PrizePool";
import { Leaderboard } from "./components/Leaderboard";
import { AchievementBadge } from "./components/AchievementBadge";
import { ExplorerLink } from "./components/ExplorerLink";
import { Confetti } from "./components/Confetti";

export default function App() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [round, setRound] = useState<RoundState>(initialMockRound);
  const [activity, setActivity] = useState<ActivityItem[]>(initialActivity);
  // Tier 1 — free predict, no wallet, instant. Tier 2 (myBetOption) is the
  // optional SOL-staked layer on top of it. See CONTRACT.md.
  const [freePick, setFreePick] = useState<OptionKey | null>(null);
  const [myBetOption, setMyBetOption] = useState<OptionKey | null>(null);
  const [pendingTx, setPendingTx] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lockedRef = useRef(false);

  const locked = Date.now() >= round.deadlineMs || round.resolved;
  lockedRef.current = locked;

  // Live numbers. In anchor mode this reads the real on-chain Round account
  // every few seconds — every device watching sees the same numbers, because
  // it's the same account. Falls back to a simulated tick (so the demo still
  // looks alive) only in fallback mode, or before the admin has initialized
  // the round on-chain yet.
  useEffect(() => {
    const id = setInterval(async () => {
      if (lockedRef.current) return;

      if (PLACE_BET_MODE === "anchor") {
        const onchain = await fetchOnChainRound(connection, wallet);
        if (onchain) {
          setRound((r) => roundAccountToState(onchain.account, { teamA: r.teamA, teamB: r.teamB, matchClock: r.matchClock }));
          return;
        }
        // Round not initialized on-chain yet — keep the demo alive on mock
        // data below instead of going blank while waiting on the admin.
      }

      setRound((r) => {
        if (Date.now() >= r.deadlineMs) return r;
        const bump = Math.random() * 0.12;
        const opt = Math.floor(Math.random() * 3) as OptionKey;
        const pools = [...r.optionPoolsSol] as [number, number, number];
        pools[opt] = Number((pools[opt] + bump).toFixed(2));
        return {
          ...r,
          optionPoolsSol: pools,
          totalPoolSol: Number((r.totalPoolSol + bump).toFixed(2)),
          participantCount: r.participantCount + (Math.random() > 0.6 ? 1 : 0),
        };
      });
      setActivity((a) => [
        { id: crypto.randomUUID(), wallet: randomFakeWallet(), option: Math.floor(Math.random() * 3) as OptionKey, ts: Date.now() },
        ...a,
      ].slice(0, 20));
    }, 3000);
    return () => clearInterval(id);
  }, [connection, wallet]);

  // Free pick: no wallet, no transaction, counts the instant you tap it.
  // This is the actual social mechanic — anyone can do this in two seconds.
  const handleFreePick = useCallback((option: OptionKey) => {
    setFreePick((prev) => (prev === null ? option : prev));
  }, []);

  const handlePlaceBet = useCallback(
    async (option: OptionKey) => {
      setError(null);
      setPendingTx(true);
      try {
        // Both paths return a real, Explorer-verifiable devnet tx signature.
        // anchor: real escrow contract (place_bet). fallback: plain SOL transfer.
        const sig =
          PLACE_BET_MODE === "anchor"
            ? await placeBetOnChain(connection, wallet, option, 0.1)
            : await placeBetFallback(connection, wallet, 0.1);
        setSignature(sig);

        setMyBetOption(option);
        setRound((r) => {
          const pools = [...r.optionPoolsSol] as [number, number, number];
          pools[option] = Number((pools[option] + 0.1).toFixed(2));
          return {
            ...r,
            optionPoolsSol: pools,
            totalPoolSol: Number((r.totalPoolSol + 0.1).toFixed(2)),
            participantCount: r.participantCount + 1,
          };
        });
        setActivity((a) => [
          { id: crypto.randomUUID(), wallet: wallet.publicKey!.toBase58(), option, ts: Date.now() },
          ...a,
        ]);
      } catch (e: any) {
        setError(e?.message ?? "Transaction failed. Check your devnet SOL balance.");
      } finally {
        setPendingTx(false);
      }
    },
    [connection, wallet]
  );

  const resolveRound = useCallback((winningOption: OptionKey) => {
    setRound((r) => ({ ...r, resolved: true, winningOption }));
  }, []);

  const leaderboard = useMemo(() => mockLeaderboard(round), [round]);
  const won = round.resolved && myBetOption !== null && myBetOption === round.winningOption;
  // Free-tier recognition — correct call with no SOL staked. Separate from
  // `won`, which is the real SOL-payout leaderboard eligibility.
  const calledItFree = round.resolved && myBetOption === null && freePick !== null && freePick === round.winningOption;

  return (
    <div className="wb-halftone" style={{ minHeight: "100vh", padding: "24px 16px 60px" }}>
      <Confetti active={won || calledItFree} />

      <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 18, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="wb-chrome-text" style={{ fontSize: 28 }}>💧 WATER BREAK</div>
          <WalletMultiButton />
        </div>

        <MatchHeader round={round} />
        <WaterBreakTimer deadlineMs={round.deadlineMs} locked={locked} />
        <PrizePool round={round} />

        {!round.resolved && (
          <PredictionPanel
            round={round}
            locked={locked}
            walletConnected={!!wallet.connected}
            pendingTx={pendingTx}
            freePick={freePick}
            onFreePick={handleFreePick}
            myBetOption={myBetOption}
            onPlaceBet={handlePlaceBet}
          />
        )}

        {error && (
          <div className="wb-card" style={{ padding: 14, borderColor: "var(--wb-pink)", color: "#ffd9e6" }}>
            {error}
          </div>
        )}

        <ExplorerLink signature={signature} />

        <CommunityStats round={round} />
        <ActivityFeed items={activity} round={round} />

        {locked && !round.resolved && (
          <div className="wb-card" style={{ padding: 20, textAlign: "center" }}>
            <div style={{ marginBottom: 10, opacity: 0.8 }}>Admin: resolve the round once the outcome happens</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              {round.options.map((label, i) => (
                <button key={label} className="wb-btn wb-btn--outline" onClick={() => resolveRound(i as OptionKey)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {round.resolved && <Leaderboard entries={leaderboard} />}
        {(won || calledItFree) && <AchievementBadge show={won || calledItFree} staked={won} />}
      </div>
    </div>
  );
}
