# waterbreaks

**A live, on-chain prediction game for the dead 90 seconds of a World Cup water break.**
Fans connect Phantom, call what happens next, and optionally stake 0.1 SOL — settled and paid
out automatically by an Anchor program on Solana devnet.

> Water Break is a **fan space, not a betting app**. The payoff is being right in front of the
> crowd — a leaderboard spot, recognition — and a small stake just makes the guess matter.

---

## 🔗 Live

| | |
|---|---|
| **Demo (Vercel)** | _added after deploy_ |
| **Program (devnet)** | [`HR51P2C3CHrw76rdtgM181SdyKSMJmyKn8yZq85eGV6Z`](https://explorer.solana.com/address/HR51P2C3CHrw76rdtgM181SdyKSMJmyKn8yZq85eGV6Z?cluster=devnet) |
| **Network** | Solana devnet |

## What it does

1. **Predict** — pick "Brazil scores next", "France scores next", or "No goal this break". Free, no wallet.
2. **Stake** — back your call with 0.1 SOL through Phantom. The SOL goes straight into a
   program-owned vault (PDA) — no custodian.
3. **Resolve** — when the break ends, the admin locks in the outcome on-chain (only possible
   after the 90-second deadline).
4. **Claim** — winners pull their proportional share of the whole pool:
   `your_stake / winning_pool × total_pool`.

## How it works (architecture)

The fan's wallet never trusts a server. `place_bet` moves SOL directly from Phantom into a
program-owned **`Round` PDA that *is* the vault** — there's no separate escrow account and no
custodial step. `resolve_round` is gated to the round authority and can only fire after the
deadline, so the outcome can't be set mid-round. Payout is **pull-based** (each winner calls
`claim_winnings`), so it scales past one demo without looping over an unbounded account list.
The frontend only builds transactions and hands them to Phantom to sign.

That's the answer to "why Solana": sub-second finality and sub-cent fees are what make staking
0.1 SOL on a 90-second window viable at all.

### On-chain interface (`anchor/programs/water_break/src/lib.rs`)

| Instruction | Caller | Purpose |
|---|---|---|
| `initialize_round(round_id, a, b, c, duration_secs)` | admin | Create the round + vault PDA |
| `place_bet(option, amount)` | fan | Stake into the vault; one bet per wallet per round |
| `resolve_round(winning_option)` | admin | Lock the outcome (only after deadline) |
| `claim_winnings()` | winner | Withdraw proportional share |

PDAs (derived client-side): `Round = ["round", round_id_le]`, `Bet = ["bet", round, wallet]`.

## Tech

- **Program:** Rust + Anchor 1.0 — checked arithmetic, pull-based payouts, PDA vault.
- **Frontend:** React + Vite + TypeScript, `@solana/wallet-adapter` (Phantom), `@coral-xyz/anchor`.
- **Design:** flat color-block streetwear system (Futura + Space Mono).

## Run locally

```bash
# Frontend
cd frontend
npm install
npm run dev          # talks to the live devnet program (anchor mode)

# Program (optional — already deployed)
cd anchor
anchor build
anchor test --validator legacy   # 7/7 end-to-end tests
```

A test wallet needs devnet SOL: https://faucet.solana.com

## Repo layout

```
anchor/      Anchor program, tests, deploy + init scripts
frontend/    React app (components, wallet, on-chain client in src/lib/program.ts)
merge.md     Full build/handoff notes
```

---

_Fan space framing: every user-facing string uses **predict / stake / leaderboard** — never bet,
wager, or odds. Internal code identifiers (`place_bet`, `Bet`) are unaffected._
