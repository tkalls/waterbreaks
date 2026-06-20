# Water Break — Full Handoff (`merge.md`)

Everything that happened, the complete backend, the frontend wiring, and exactly what's
left for the frontend partner to finish. Self-contained — you don't need the chat history.

**Project root (it was moved):** `/Users/tobi/Desktop/worldcup`
(It used to live at `/Users/tobi/worldcup`; a couple of helper scripts still reference the
old path — see "Known path debt" at the bottom.)

---

## 0. TL;DR status

| Layer | State |
|---|---|
| Anchor program | ✅ Written, compiled, **7/7 tests passing**, 2 bugs fixed |
| Devnet deploy | ✅ **Live** — program + demo round initialized on-chain |
| IDL handoff | ✅ `frontend/src/idl/water_break.json` + `.ts` |
| Frontend wiring | ✅ `program.ts` anchor functions done, `App.tsx` place-bet wired, `tsc` + `vite build` clean |
| Env switch | ✅ `frontend/.env` set to **anchor mode** |
| Redesign | ✅ Flat color-block theme applied, builds green |
| **Remaining (partner)** | ⬜ Wire on-chain **resolve + claim** into the UI, ⬜ fresh round before demo, ⬜ visual QA |

**The app works end-to-end right now in anchor mode** (real escrow contract) and falls back
to a plain devnet transfer with a one-line `.env` change.

---

## 1. What this is

Water Break is a **fan space, not a betting app**. During a World Cup water break, fans
connect Phantom, predict what happens next, and optionally stake 0.1 SOL. Payouts are
proportional and on-chain. **Language rule: predict / stake / leaderboard. Never bet, wager,
or odds** in any user-facing copy, slide, or doc.

Two pieces:
- `anchor/` — the Rust/Anchor program (the escrow + resolution logic).
- `frontend/` — React + Vite + Phantom (wallet-adapter) UI.

### Shared constants (hardcoded identically front & back — do not change without telling the other side)
- Network: **Solana devnet**
- Stake: **0.1 SOL** = `100_000_000` lamports, fixed
- Match: **Brazil vs France, Round of 16**
- Options (exact order): `0 = "Brazil scores next"`, `1 = "France scores next"`, `2 = "No goal this break"`
- Round length: **90 seconds** from creation

---

## 2. Live on-chain values (devnet) — paste-ready

| Thing | Value |
|---|---|
| **Program ID** | `HR51P2C3CHrw76rdtgM181SdyKSMJmyKn8yZq85eGV6Z` |
| **Admin / upgrade authority / treasury wallet** | `2zLeShndJu31Aui1mhHHB1zsS7zQD52YNi1AhTMhmJjT` (`~/.config/solana/id.json`) |
| **Demo round PDA** (`round_id = 1`) | `6T4AQC5hrtn2PLDgfkDhPNmHu5znXJHipUsKaA9D5S8P` |
| **Working RPC** (free, no key) | `https://solana-devnet.api.onfinality.io/public` |
| Program size | 211,952 bytes |

Explorer:
- Program: https://explorer.solana.com/address/HR51P2C3CHrw76rdtgM181SdyKSMJmyKn8yZq85eGV6Z?cluster=devnet
- Round PDA: https://explorer.solana.com/address/6T4AQC5hrtn2PLDgfkDhPNmHu5znXJHipUsKaA9D5S8P?cluster=devnet

> ⚠️ **The public RPC `api.devnet.solana.com` is heavily IP-rate-limited (429s).** We deploy
> and read through OnFinality's free public endpoint instead. The frontend `.env` already
> points at it via `VITE_RPC_URL`.

---

## 3. The contract (what each instruction does)

Source: `anchor/programs/water_break/src/lib.rs`. Four instructions, two accounts.

| Instruction | Who | Notes |
|---|---|---|
| `initialize_round(round_id, option_a, option_b, option_c, duration_secs)` | admin | Creates the round PDA (also the vault). |
| `place_bet(option: u8, amount: u64)` | fan | Moves SOL into the round PDA via System CPI. Fails if locked/resolved. One `Bet` PDA per wallet per round. |
| `resolve_round(winning_option: u8)` | admin | Only after the deadline passes. Sets the winner. |
| `claim_winnings()` | each winner | Pull-based. Payout = `stake / winning_pool * total_pool`, paid by direct lamport move from the PDA. |

**Trust model:** the round PDA *is* the vault — no custodial step. `resolve_round` is gated to
the round authority and can't fire before the deadline. Payout is pull-based so it scales past
one demo. Frontend never holds funds; it only builds txs for Phantom to sign.

**PDA derivation (frontend already does this):**
- Round: seeds `["round", round_id as u64 little-endian]`
- Bet: seeds `["bet", round_pda, wallet_pubkey]`

---

## 4. Toolchain (what's installed on this machine)

- rustc **1.96.0**
- Solana/Agave CLI **3.1.10**
- Anchor CLI **1.0.2** (anchor-lang **1.0.2**)
- Node **26**
- JS client `@coral-xyz/anchor` **0.32.1** (lags the CLI but uses the same post-0.30 IDL format)

---

## 5. Bugs fixed + environment gotchas (so they don't bite you again)

1. **`claim_winnings` runtime failure** — the `round` PDA wasn't `#[account(mut)]` in
   `ClaimWinnings`, but the instruction debits lamports from it. Added `mut`. (Fixed.)
2. **Anchor 1.0 breaking change** — `CpiContext::new` now takes a `Pubkey` (program id),
   not an `AccountInfo`. `place_bet`'s System transfer uses
   `ctx.accounts.system_program.key()`. (Fixed.)
3. **Program `Cargo.toml`** — bumped `anchor-lang` to `1.0.2` and added the required
   `idl-build` feature (Anchor ≥0.30 needs it for IDL generation).
4. **Node 26 broke old mocha/yargs** (`require is not defined in ES module scope`) — bumped
   `mocha` + `ts-mocha` to v11.
5. **Anchor 1.0 test runner defaults to `surfpool`** (not installed) — run tests with
   `--validator legacy` to use `solana-test-validator`.
6. **`scripts/init-round.ts` JSON import** — ts-node needs `resolveJsonModule`; passed via a
   CLI flag (see deploy commands below) so no tsconfig edit is required.

---

## 6. Tests (passing)

```bash
cd anchor
anchor test --skip-build --provider.cluster localnet --validator legacy
```
Covers the whole lifecycle + guards (7 passing):
init round → two fans predict → reject-resolve-before-deadline → resolve →
winner gets full proportional pool → reject double-claim → reject loser-claim.

---

## 7. Frontend wiring (what's done)

- **IDL + types:** `frontend/src/idl/water_break.json` and `water_break.ts`.
- **`frontend/src/lib/program.ts`** (TESTED — do not logically alter) exposes:
  - `placeBetFallback(connection, wallet, amountSol)` — plain devnet transfer (fallback mode).
  - `placeBetOnChain(connection, wallet, option, amountSol[, roundId])` — real `place_bet`.
  - `claimWinningsOnChain(connection, wallet[, roundId])`
  - `initializeRoundOnChain(...)`, `resolveRoundOnChain(connection, wallet, winningOption[, roundId])`
  - `fetchOnChainRound(connection, wallet[, roundId])` → live `Round` account (read-only).
  - `roundAccountToState(account, meta)` → maps on-chain account onto `RoundState`.
  - `getProgram`, `deriveRoundPda`, `deriveBetPda`, `PROGRAM_ID`, `DEMO_ROUND_ID`.
- **`frontend/src/App.tsx`** — `handlePlaceBet` calls `placeBetOnChain` in anchor mode,
  `placeBetFallback` otherwise. The two-tier flow is preserved: `freePick` (free, no wallet,
  tier 1) is separate from `myBetOption` (staked, tier 2). The poll effect reads the live
  on-chain round in anchor mode.
- **`frontend/src/lib/wallet.tsx`** — Phantom + devnet connection provider (TESTED — leave it).
- **Buffer polyfill** (`main.tsx`) and `vite.config.ts` `global`/`process.env` are in place,
  so anchor mode's PDA derivation works in the browser.

### `frontend/.env` (already set to anchor mode)
```
VITE_SOLANA_NETWORK=devnet
VITE_RPC_URL=https://solana-devnet.api.onfinality.io/public
VITE_PLACE_BET_MODE=anchor
VITE_PROGRAM_ID=HR51P2C3CHrw76rdtgM181SdyKSMJmyKn8yZq85eGV6Z
VITE_ROUND_ID=1
VITE_TREASURY_PUBKEY=2zLeShndJu31Aui1mhHHB1zsS7zQD52YNi1AhTMhmJjT
```
To revert to the safe fallback at any time: set `VITE_PLACE_BET_MODE=fallback` and restart vite.

---

## 8. Design system (already applied)

`frontend/src/styles/theme.css` was fully replaced with a **flat color-block** system —
reference: 2020s Nike/New Balance streetwear + 2000s football energy. No gradients, glow, or
chrome; hard-edge offset shadows; ticket/boarding-pass motifs.

- Palette tokens: `--ink #111`, `--paper #F4EEE1`, `--yellow #F4E04D`, `--orange #E8501F`,
  `--red #E8341F`, `--navy #0B2B3C`, `--lavender #8B7FD6`. (Old `--wb-*` names kept as aliases.)
- Type: **Futura** (native on macOS; Oswald fallback) for display caps, **Space Mono** for metadata.
- Restyled: `MatchHeader` (navy block), `WaterBreakTimer` (yellow→orange→red flat swap),
  `PrizePool` (ticket w/ perforation + barcode), `PredictionPanel` (color-block options,
  ink selected), `AchievementBadge` + `Confetti` flattened. The rest ride the dark default card.

---

## 9. Run it

```bash
cd /Users/tobi/Desktop/worldcup/frontend
npm install        # node_modules is already present, but safe to re-run
npm run dev        # anchor mode, talks to the live devnet contract
```
Get devnet SOL for a test wallet: web faucet at https://faucet.solana.com (the CLI airdrop is
IP-throttled here).

### Redeploy / fresh round (only if needed)
```bash
cd /Users/tobi/Desktop/worldcup/anchor
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
RPC=https://solana-devnet.api.onfinality.io/public

anchor build
anchor deploy --provider.cluster "$RPC"     # CLI override keeps Anchor.toml untouched
```

---

## 10. ⚠️ MUST DO before a live demo — spin a fresh round

The round's **90-second deadline is fixed at creation**. `round_id = 1` is already expired
(`place_bet` returns `BettingClosed`). Right before demoing, create a fresh round and point
the frontend at it:

```bash
cd /Users/tobi/Desktop/worldcup/anchor
ANCHOR_PROVIDER_URL=https://solana-devnet.api.onfinality.io/public \
ANCHOR_WALLET=~/.config/solana/id.json ROUND_ID=2 \
  npx ts-node --compiler-options '{"resolveJsonModule":true,"esModuleInterop":true}' scripts/init-round.ts
```
Then set `VITE_ROUND_ID=2` in `frontend/.env` and restart `vite`. Bump the ID each run
(one bet account per wallet per round, so a new ID lets you run the loop repeatedly).

---

## 11. What's LEFT for the frontend partner

1. **Wire on-chain resolve + claim into the UI** (helpers already exist in `program.ts`):
   - The admin "resolve" button in `App.tsx` currently calls the *local* `resolveRound`
     (state only). For the full on-chain demo, also call
     `resolveRoundOnChain(connection, wallet, winningOption)`.
   - Add a "Claim winnings" action for winners → `claimWinningsOnChain(connection, wallet)`.
   - Both are optional for the pitch (staking already proves on-chain), but they complete the loop.
2. **Run a fresh round before demo** (Section 10) and confirm `VITE_ROUND_ID` matches.
3. **Visual QA** of the new flat theme on a real screen; tighten spacing/contrast to taste.
4. **Definition of done** (from `CONTRACT.md`): Phantom connects on devnet for both of you;
   staking yields a real signature + Explorer link; timer locks → resolve → leaderboard +
   confetti; no "bet/wager/odds" copy; full loop run twice without refresh; flipping
   `VITE_PLACE_BET_MODE` between `anchor`/`fallback` doesn't break anything visually.

---

## 12. The `frontend.zip` / `frontend 2` situation (so nobody chases it again)

`frontend.zip`, `frontend 2`, `Downloads/frontend`, and `Downloads/frontend 3` are all the
**same corrupted extraction**: only 163-byte macOS `._` AppleDouble metadata stubs, **zero real
source files**. There is nothing to merge from any of them — delete them to avoid confusion.
The one and only real, complete frontend is `/Users/tobi/Desktop/worldcup/frontend` (this one).

---

## 13. Known path debt (minor)

These still hardcode the old `/Users/tobi/worldcup` path (harmless unless re-run):
- `anchor/scripts/deploy-devnet.sh`
- `.superstack/build-context.md`

Update them to `/Users/tobi/Desktop/worldcup` if you plan to use them.

---

## 14. Verification at time of writing
- `frontend`: `npx tsc --noEmit` ✅ and `npm run build` ✅ (built in ~3s).
- Program live on devnet ✅ (`solana program show` returns the program, admin authority intact).
- Anchor mode reads the live round; fallback mode available via one `.env` line.
