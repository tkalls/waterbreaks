# Water Break — build contract (frontend ⇄ backend)

This is the one file you need. It's self-contained — you don't need the rest of the repo to start, though if Tobi sent you the `frontend/` folder too, start from that instead of scratch. Either way, this file is the source of truth for where your half ends and the other half begins. From this point: only building.

## Shared constants — both of you hardcode these identically, no exceptions
- Network: **Solana devnet**
- Stake: **0.1 SOL** per prediction, fixed
- Demo match: **Brazil vs France, Round of 16**
- Options, in this exact order: `0 = "Brazil scores next"`, `1 = "France scores next"`, `2 = "No goal this break"`
- Round length: **90 seconds** from the moment it's created
- Framing: this is a **fan space, not a betting app**. Every visible word: predict, stake, leaderboard. Never: bet, wager, odds.

If either of you changes any of these, say so out loud before changing it — a mismatch here is the kind of bug that only shows up live.

## Two-tier interaction — read this before building any wallet-gating logic
This is a social event, not a fintech app. Nobody should need a wallet, a login, or a funded account just to participate in the fun part. Build it as two tiers:

- **Tier 1 — free predict, no wallet.** Anyone taps an option and it counts immediately in the live community read (the percentages, the activity feed). If they're right when the round resolves, they show up on a free "called it" list — recognition, no SOL involved. This is the actual social mechanic — a stranger in a fan zone should be able to do this in two seconds with no setup.
- **Tier 2 — staked predict, wallet required.** Connect Phantom, stake 0.1 SOL, eligible for the real SOL payout leaderboard. Entirely optional, layered on top of tier 1, never required to participate.

Don't disable the predict action while the wallet is disconnected — only disable the *stake* action. Tier 1 should work the instant the page loads.

## Make the live numbers actually shared, not simulated per browser
Once the program is deployed, the on-chain `Round` account is a shared source of truth for every device watching the same round — read it directly (poll every few seconds, or subscribe via `onAccountChange`) instead of faking the pool/activity numbers with a local `setInterval`. That's the difference between "looks live" and "is live": two people on two phones should see the exact same number tick up at the exact same moment, because they're reading the same account. No custom backend needed — the chain already is the shared backend.

## Status — what's actually implemented right now, not just specced
Both layers above are wired into `frontend/src/` already, not just described here:
- `lib/program.ts` has real functions for both tiers: `placeBetOnChain` / `placeBetFallback` (tier 2, mode-switched), and `fetchOnChainRound` + `roundAccountToState` (the live shared read — polls the real `Round` account and falls back to the simulated feed only if the round hasn't been initialized on-chain yet).
- `App.tsx` has a `freePick` state separate from the staked `myBetOption` — tapping a prediction never checks wallet connection; only the "back it with SOL" button does.
- `PredictionPanel.tsx` and `AchievementBadge.tsx` reflect both tiers visually (free pick vs staked pick, "called it" vs "staked and called it").
- The IDL (`frontend/src/idl/water_break.json` + `.ts`) is already in the repo, meaning `anchor build` has succeeded — type-checked and built clean as of this writing.

This was sequenced specifically so neither of you blocks the other: tier 1 (free predict) is pure local React state with zero chain dependency, so it didn't need to wait on the contract. The live on-chain read was written against the already-generated IDL, so it didn't need to wait on a frontend redesign. If you're rebuilding the UI from scratch per `FRONTEND_BRIEF.md`, treat `App.tsx` and `lib/program.ts` as the reference implementation for this logic — keep the state shape (`freePick` separate from `myBetOption`) even if every pixel around it changes.

**What's still unverified:** whether `anchor deploy` has actually run (the IDL existing means `anchor build` succeeded, not that the program is live on devnet) — confirm that with backend directly, since `fetchOnChainRound` will just silently fall back to mock data if the account doesn't exist yet, which looks fine but isn't actually reading real data.

## Frontend — what you need from backend
1. **Right now, to start building:** a devnet wallet public key to send fake stakes to (the interim treasury). Ask for it, it's one string, costs nothing to hand over immediately.
2. **Program ID:** already generated — `HR51P2C3CHrw76rdtgM181SdyKSMJmyKn8yZq85eGV6Z`. Confirm with backend whether it's actually deployed to devnet yet (`anchor build` sets this ID before `anchor deploy` actually ships it) before you rely on reading the account from it.
3. **The IDL file** (`water_break.json`, generated by `anchor build`) — needed once you wire up real on-chain reads/writes via `@coral-xyz/anchor`.
4. Build your app to read three things from env vars so backend can hand you exact values to paste in, no code changes on your end:
   - `VITE_PLACE_BET_MODE` — `"fallback"` (plain transfer, works today) or `"anchor"` (real contract, works once deployed)
   - `VITE_TREASURY_PUBKEY` — used in fallback mode
   - `VITE_PROGRAM_ID` — used in anchor mode (already known: see above)
5. You are never blocked. Build and demo against fallback mode the whole time; treat the upgrade to anchor mode as something that might happen in the last 10 minutes, or not at all.

## Backend — what you need from frontend
Almost nothing, functionally. Two things:
1. Confirm the three env var names above are what your app actually reads, before backend wires anything up.
2. Once you're staking successfully against the fallback treasury key, say so — that's the signal the plumbing works end to end and backend's job is now purely "make the real contract a drop-in replacement," not "debug why nothing connects."

## The on-chain interface — build the frontend against this even with zero backend code in hand
Four instructions, this is the whole contract surface:

- **`initialize_round(round_id: u64, option_a: string, option_b: string, option_c: string, duration_secs: i64)`** — admin only. Creates the round.
- **`place_bet(option: u8, amount: u64)`** — fan signs. `option` is 0/1/2, `amount` is lamports (0.1 SOL = 100,000,000 lamports). Fails if the round is locked or resolved.
- **`resolve_round(winning_option: u8)`** — admin only, only callable after the deadline passes.
- **`claim_winnings()`** — each winner calls this once after resolve. Payout is proportional: `your_stake / total_staked_on_winning_option * total_pool`.

PDA addresses (deterministic, derivable on the frontend without asking backend anything):
- Round account: seeds `["round", round_id as 8-byte little-endian bytes]`
- Bet account: seeds `["bet", round_pda_pubkey, your_wallet_pubkey]`

## Definition of done — run this together once, out loud, before judging
- [ ] Anyone can predict with zero wallet connected (tier 1 works on page load)
- [ ] Phantom connects on devnet for both of you, separately, on your own machines
- [ ] Staking produces a real transaction signature with a working Explorer link
- [ ] Timer locks at zero, resolve fires, leaderboard + confetti show up
- [ ] No visible copy says bet, wager, or odds
- [ ] You've run the full loop twice without refreshing the page
- [ ] If the real contract deployed: flipping `VITE_PLACE_BET_MODE` to `anchor` doesn't break anything visually, and two devices watching the same round see the same live numbers

If every box is checked, you have a demo that can't bust regardless of which mode it's running in.
