# MVP scope — read this before either of you builds anything else

## Verdict
Feasible, and interactive/fun enough to demo well — but only if you both treat the full Anchor escrow contract as a bonus layer, not a dependency. The thing that makes this demo good is small and already works. The thing that makes it impressive (a real on-chain escrow) is a stretch goal that can fail completely without taking the demo down with it. That split is the whole point of this document.

## The stripped-down core — this is the project
Five pieces, all already built, none of them depend on the Anchor program deploying:

1. **Phantom connects on devnet.** Table stakes — proves "we're real Solana" before anything else happens.
2. **One real signed transaction.** Fan stakes 0.1 SOL, Phantom signs, it confirms on devnet, you click a real Explorer link live in front of judges. This is the single most important thing in the whole demo — it's the difference between "uses blockchain buzzwords" and "is actually on-chain." It does not require the Anchor program; `placeBetFallback` already does this with a plain transfer.
3. **A deterministic local state machine.** Countdown timer → locks at zero → admin resolve button → leaderboard + confetti + badge. This is plain React state, no network dependency, cannot fail unless someone breaks the code.
4. **A live feeling.** Pool size, percentages, and activity feed tick up on their own (simulated). Judges read this as "the network is active" — nobody is going to ask you to prove every wallet in the feed is real, and if they do, the honest answer ("staking is live, the surrounding activity is simulated for the demo") is a fine answer.
5. **The framing.** Fan space, not betting app — already locked in `README.md`.

If only these five things exist by the time you present, you have a complete, working, honest demo. Everything below is upside, not requirement.

## The stretch layer — additive, isolated, allowed to fail
The real Anchor program (`anchor/`, `BACKEND_BRIEF.md`) — escrow PDA, on-chain resolve, proportional payout via `claim_winnings`. If it deploys and gets wired in time, you flip one env var (`VITE_PLACE_BET_MODE=anchor`) and the demo upgrades from "real transfer" to "real escrow contract" with zero changes to the UI. If it doesn't deploy in time, you flip nothing, say nothing, and the demo runs exactly as well on the fallback path. This is why the two of you can work in parallel without one person's slippage breaking the other's half — the frontend was built to not care which mode it's in.

## Definition of done — check this before you stop building
- [ ] `npm run dev` boots with no console errors
- [ ] Phantom connects on devnet (real wallet, real network, even if balance is low)
- [ ] Staking a prediction produces a real transaction signature and a working Explorer link
- [ ] Timer counts down, locks at zero, resolve button works, leaderboard + confetti fire
- [ ] No UI copy says "bet," "wager," or "odds" anywhere a judge can see
- [ ] You can run the full loop twice in a row without refreshing and it doesn't break

If every box is checked, you have a safe demo regardless of what state the Anchor program is in. Don't keep building past this list under time pressure — polish the demo script and rehearse it instead.

## The actual failure mode to watch for
Not "the smart contract doesn't compile." That's an acceptable, recoverable failure — you just stay on the fallback path and say so. The real risk is two people editing in parallel without checking this list, discovering an integration gap five minutes before judging. Re-run the checklist together once, out loud, before you stop.
