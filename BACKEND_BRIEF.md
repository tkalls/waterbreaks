# Backend brief — Water Break

You own the Anchor program, deployment, and the real on-chain wiring. Your teammate owns everything visual (their brief is `FRONTEND_BRIEF.md`) — don't wait on them, and don't let them wait on you longer than necessary. Open this `worldcup` folder directly in Claude Code so `.claude/skills/` auto-discovers.

One framing note even though you're not writing UI copy: if you touch any pitch slides, error messages, or program docs/comments that a judge might read, this is a fan space, not a betting app — "predict," "stake," "leaderboard," never "bet," "wager," "odds." Full table in `README.md` under "What this is — say this exactly." Internal Rust/TS identifiers (`place_bet`, `Bet` account, etc.) are fine to leave as-is.

## What exists already
`anchor/programs/water_break/src/lib.rs` is a complete program: `initialize_round`, `place_bet`, `resolve_round`, `claim_winnings`. It has not been compiled yet — no Rust/Anchor toolchain was available where it was written, so treat it as a strong draft, not verified-correct code. Read `README.md`'s architecture section before touching anything; it explains why the program is shaped the way it is (PDA-as-vault, pull-based payout).

## Task list, in order

1. **Compile it.** `cd anchor && anchor build`. Fix whatever Rust/Anchor version mismatches or syntax issues come up — use `.claude/skills/debug-program` instead of trial-and-error if errors aren't immediately obvious.
2. **Get a real program ID.** `anchor keys list`, then paste that ID into both `declare_id!()` at the top of `lib.rs` and into `anchor/Anchor.toml` (`[programs.devnet]` and `[programs.localnet]`). Rebuild.
3. **Deploy to devnet.** `anchor deploy --provider.cluster devnet`. Use `.claude/skills/deploy-to-mainnet` for the deployment checklist even though you're targeting devnet — same steps minus the mainnet-specific risk items.
4. **Write a quick integration test** (even a minimal one) that calls `initialize_round` → `place_bet` → `resolve_round` → `claim_winnings` end to end on localnet before trusting devnet. `.claude/skills/build-defi-protocol` has patterns for this if you want a faster path than writing it from scratch.
5. **Hand off the IDL.** `anchor build` generates `anchor/target/idl/water_break.json`. Copy it into the frontend (path is up to you and your teammate, but `frontend/src/idl/` is a reasonable spot) and wire up `@coral-xyz/anchor`'s `Program` class in `frontend/src/lib/program.ts` — the exact shape needed is already commented at the bottom of that file (`placeBetOnChain` stub, PDA derivation included).
6. **Flip the switch.** Set `VITE_PLACE_BET_MODE=anchor` and `VITE_PROGRAM_ID=<your deployed ID>` in `frontend/.env`. Tell your teammate the moment this works — it's the one thing that changes their demo from "real transaction to a wallet" to "real escrow contract."

## Fallback awareness
Until you've deployed, the frontend runs on `placeBetFallback` — a plain devnet SOL transfer, not the real program. That's intentional so your teammate isn't blocked. If you're not going to finish the full deploy in time, tell them explicitly rather than letting it be a surprise during the demo — the pitch can honestly say "staking is live on devnet, full escrow logic is in the deployed program, here's the source" and still land.

## Cost discipline
Same note as the frontend brief: the skills cost nothing extra, they're just reference files. Don't ask Claude Code open-ended questions like "is this secure" — ask specific ones ("does `claim_winnings` handle a zero winning_pool correctly", "is the PDA seed derivation in `PlaceBet` consistent with `InitializeRound`") so it checks the actual thing instead of re-reading the whole file tree.
