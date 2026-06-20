# Water Break — Full System Source

Generated Sat Jun 20 15:33:30 +08 2026. Every hand-written source file in the project, concatenated.
Excludes: node_modules, dist, target, lockfiles, and the generated IDL
(`frontend/src/idl/water_break.json` + `.ts` — produced by `anchor build`).

## Table of contents
- `anchor/Anchor.toml`
- `anchor/Cargo.toml`
- `anchor/programs/water_break/Cargo.toml`
- `anchor/programs/water_break/src/lib.rs`
- `anchor/tests/water_break.ts`
- `anchor/scripts/init-round.ts`
- `anchor/scripts/deploy-devnet.sh`
- `frontend/package.json`
- `frontend/index.html`
- `frontend/vite.config.ts`
- `frontend/tsconfig.json`
- `frontend/.env`
- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/lib/program.ts`
- `frontend/src/lib/wallet.tsx`
- `frontend/src/lib/mockData.ts`
- `frontend/src/styles/theme.css`
- `frontend/src/components/MatchHeader.tsx`
- `frontend/src/components/WaterBreakTimer.tsx`
- `frontend/src/components/PrizePool.tsx`
- `frontend/src/components/PredictionPanel.tsx`
- `frontend/src/components/CommunityStats.tsx`
- `frontend/src/components/ActivityFeed.tsx`
- `frontend/src/components/Leaderboard.tsx`
- `frontend/src/components/AchievementBadge.tsx`
- `frontend/src/components/ExplorerLink.tsx`
- `frontend/src/components/Confetti.tsx`

---

## `anchor/Anchor.toml`

```toml
[toolchain]

[features]
seeds = false
skip-lint = false

[programs.localnet]
water_break = "HR51P2C3CHrw76rdtgM181SdyKSMJmyKn8yZq85eGV6Z"

[programs.devnet]
water_break = "HR51P2C3CHrw76rdtgM181SdyKSMJmyKn8yZq85eGV6Z"

[registry]
url = "https://api.apr.dev"

[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"

[scripts]
test = "npx ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"
```

## `anchor/Cargo.toml`

```toml
[workspace]
members = ["programs/*"]
resolver = "2"

[profile.release]
overflow-checks = true
```

## `anchor/programs/water_break/Cargo.toml`

```toml
[package]
name = "water_break"
version = "0.1.0"
description = "Water Break - World Cup water-break prediction market on Solana"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]
name = "water_break"

[features]
no-entrypoint = []
no-idl = []
no-log-ix-name = []
cpi = ["no-entrypoint"]
default = []
idl-build = ["anchor-lang/idl-build"]

[dependencies]
anchor-lang = "1.0.2"
```

## `anchor/programs/water_break/src/lib.rs`

```rust
use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("HR51P2C3CHrw76rdtgM181SdyKSMJmyKn8yZq85eGV6Z");

const MAX_OPTIONS: usize = 3;

#[program]
pub mod water_break {
    use super::*;

    /// Admin creates a new prediction round for the upcoming water break.
    /// `duration_secs` is how long the betting window stays open (e.g. 90).
    pub fn initialize_round(
        ctx: Context<InitializeRound>,
        round_id: u64,
        option_a: String,
        option_b: String,
        option_c: String,
        duration_secs: i64,
    ) -> Result<()> {
        require!(
            option_a.len() <= 32 && option_b.len() <= 32 && option_c.len() <= 32,
            WaterBreakError::OptionTooLong
        );

        let round = &mut ctx.accounts.round;
        round.authority = ctx.accounts.authority.key();
        round.round_id = round_id;
        round.options = [option_a, option_b, option_c];
        round.deadline = Clock::get()?.unix_timestamp + duration_secs;
        round.resolved = false;
        round.winning_option = 255; // sentinel = unresolved
        round.option_pools = [0, 0, 0];
        round.total_pool = 0;
        round.bet_count = 0;
        round.bump = ctx.bumps.round;

        emit!(RoundInitialized {
            round: round.key(),
            round_id,
            deadline: round.deadline,
        });
        Ok(())
    }

    /// Fan stakes `amount` lamports on `option` (0, 1, or 2).
    pub fn place_bet(ctx: Context<PlaceBet>, option: u8, amount: u64) -> Result<()> {
        let round = &mut ctx.accounts.round;
        require!(!round.resolved, WaterBreakError::RoundResolved);
        require!(
            Clock::get()?.unix_timestamp < round.deadline,
            WaterBreakError::BettingClosed
        );
        require!((option as usize) < MAX_OPTIONS, WaterBreakError::InvalidOption);
        require!(amount > 0, WaterBreakError::ZeroAmount);

        // SOL moves straight from the fan's wallet into the round PDA,
        // which doubles as the pool vault. No middleman ever touches it.
        // Anchor 1.0: CpiContext::new takes the program *id* (Pubkey), not its
        // AccountInfo. The from/to AccountInfos travel in the Transfer struct.
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                system_program::Transfer {
                    from: ctx.accounts.better.to_account_info(),
                    to: round.to_account_info(),
                },
            ),
            amount,
        )?;

        let bet = &mut ctx.accounts.bet;
        bet.better = ctx.accounts.better.key();
        bet.round = round.key();
        bet.option = option;
        bet.amount = amount;
        bet.claimed = false;
        bet.bump = ctx.bumps.bet;

        round.option_pools[option as usize] = round.option_pools[option as usize]
            .checked_add(amount)
            .ok_or(WaterBreakError::Overflow)?;
        round.total_pool = round
            .total_pool
            .checked_add(amount)
            .ok_or(WaterBreakError::Overflow)?;
        round.bet_count = round
            .bet_count
            .checked_add(1)
            .ok_or(WaterBreakError::Overflow)?;

        emit!(BetPlaced {
            round: round.key(),
            better: bet.better,
            option,
            amount,
            total_pool: round.total_pool,
            bet_count: round.bet_count,
        });
        Ok(())
    }

    /// Admin-only. Locks in the correct outcome once the break ends and the
    /// match resumes. Must be called after the deadline has passed.
    pub fn resolve_round(ctx: Context<ResolveRound>, winning_option: u8) -> Result<()> {
        let round = &mut ctx.accounts.round;
        require!(!round.resolved, WaterBreakError::RoundResolved);
        require!(
            Clock::get()?.unix_timestamp >= round.deadline,
            WaterBreakError::BettingStillOpen
        );
        require!(
            (winning_option as usize) < MAX_OPTIONS,
            WaterBreakError::InvalidOption
        );
        require_keys_eq!(
            ctx.accounts.authority.key(),
            round.authority,
            WaterBreakError::Unauthorized
        );

        round.resolved = true;
        round.winning_option = winning_option;

        emit!(RoundResolved {
            round: round.key(),
            winning_option,
            total_pool: round.total_pool,
            winning_pool: round.option_pools[winning_option as usize],
        });
        Ok(())
    }

    /// Each winner calls this once. Payout is their proportional share of the
    /// entire pool based on how much they staked on the winning option:
    ///   payout = bet.amount * total_pool / option_pools[winning_option]
    /// This is a pull-based claim so it scales to any number of bettors
    /// without one instruction looping over an unbounded account list.
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let round = &ctx.accounts.round;
        let bet = &mut ctx.accounts.bet;

        require!(round.resolved, WaterBreakError::RoundNotResolved);
        require!(!bet.claimed, WaterBreakError::AlreadyClaimed);
        require!(
            bet.option == round.winning_option,
            WaterBreakError::NotAWinner
        );

        let winning_pool = round.option_pools[round.winning_option as usize];
        require!(winning_pool > 0, WaterBreakError::NoWinningPool);

        let payout = (bet.amount as u128)
            .checked_mul(round.total_pool as u128)
            .ok_or(WaterBreakError::Overflow)?
            .checked_div(winning_pool as u128)
            .ok_or(WaterBreakError::Overflow)? as u64;

        bet.claimed = true;

        **round.to_account_info().try_borrow_mut_lamports()? -= payout;
        **ctx
            .accounts
            .better
            .to_account_info()
            .try_borrow_mut_lamports()? += payout;

        emit!(WinningsClaimed {
            round: round.key(),
            better: bet.better,
            payout,
        });
        Ok(())
    }
}

#[account]
pub struct Round {
    pub authority: Pubkey,
    pub round_id: u64,
    pub options: [String; MAX_OPTIONS],
    pub deadline: i64,
    pub resolved: bool,
    pub winning_option: u8,
    pub option_pools: [u64; MAX_OPTIONS],
    pub total_pool: u64,
    pub bet_count: u32,
    pub bump: u8,
}

impl Round {
    pub const MAX_SIZE: usize = 8 // discriminator
        + 32 // authority
        + 8 // round_id
        + (4 + 32) * MAX_OPTIONS // options: String = 4 byte len + up to 32 bytes
        + 8 // deadline
        + 1 // resolved
        + 1 // winning_option
        + 8 * MAX_OPTIONS // option_pools
        + 8 // total_pool
        + 4 // bet_count
        + 1; // bump
}

#[account]
pub struct Bet {
    pub better: Pubkey,
    pub round: Pubkey,
    pub option: u8,
    pub amount: u64,
    pub claimed: bool,
    pub bump: u8,
}

impl Bet {
    pub const MAX_SIZE: usize = 8 + 32 + 32 + 1 + 8 + 1 + 1;
}

#[derive(Accounts)]
#[instruction(round_id: u64)]
pub struct InitializeRound<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = Round::MAX_SIZE,
        seeds = [b"round", round_id.to_le_bytes().as_ref()],
        bump
    )]
    pub round: Account<'info, Round>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub better: Signer<'info>,

    #[account(
        mut,
        seeds = [b"round", round.round_id.to_le_bytes().as_ref()],
        bump = round.bump
    )]
    pub round: Account<'info, Round>,

    #[account(
        init,
        payer = better,
        space = Bet::MAX_SIZE,
        seeds = [b"bet", round.key().as_ref(), better.key().as_ref()],
        bump
    )]
    pub bet: Account<'info, Bet>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveRound<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"round", round.round_id.to_le_bytes().as_ref()],
        bump = round.bump,
        has_one = authority
    )]
    pub round: Account<'info, Round>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub better: Signer<'info>,

    // `mut` is required: claim_winnings debits lamports from this PDA (the vault)
    // via try_borrow_mut_lamports, which fails at runtime on a non-writable account.
    #[account(
        mut,
        seeds = [b"round", round.round_id.to_le_bytes().as_ref()],
        bump = round.bump
    )]
    pub round: Account<'info, Round>,

    #[account(
        mut,
        seeds = [b"bet", round.key().as_ref(), better.key().as_ref()],
        bump = bet.bump,
        has_one = better
    )]
    pub bet: Account<'info, Bet>,
}

#[event]
pub struct RoundInitialized {
    pub round: Pubkey,
    pub round_id: u64,
    pub deadline: i64,
}

#[event]
pub struct BetPlaced {
    pub round: Pubkey,
    pub better: Pubkey,
    pub option: u8,
    pub amount: u64,
    pub total_pool: u64,
    pub bet_count: u32,
}

#[event]
pub struct RoundResolved {
    pub round: Pubkey,
    pub winning_option: u8,
    pub total_pool: u64,
    pub winning_pool: u64,
}

#[event]
pub struct WinningsClaimed {
    pub round: Pubkey,
    pub better: Pubkey,
    pub payout: u64,
}

#[error_code]
pub enum WaterBreakError {
    #[msg("Option label too long (max 32 chars)")]
    OptionTooLong,
    #[msg("This round has already been resolved")]
    RoundResolved,
    #[msg("Betting window has closed for this round")]
    BettingClosed,
    #[msg("Betting window is still open")]
    BettingStillOpen,
    #[msg("Invalid prediction option")]
    InvalidOption,
    #[msg("Stake amount must be greater than zero")]
    ZeroAmount,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Only the round authority can resolve it")]
    Unauthorized,
    #[msg("Round has not been resolved yet")]
    RoundNotResolved,
    #[msg("Winnings already claimed")]
    AlreadyClaimed,
    #[msg("This bet did not pick the winning option")]
    NotAWinner,
    #[msg("No winning pool to distribute from")]
    NoWinningPool,
}
```

## `anchor/tests/water_break.ts`

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { WaterBreak } from "../target/types/water_break";
import { PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

// End-to-end happy-path + guard checks for the Water Break prediction program:
//   initialize_round -> place_bet (winner + loser) -> resolve_round -> claim_winnings
//
// Mirrors the shared CONTRACT.md constants: 0.1 SOL stake, options 0/1/2.
// Uses a short round duration so the test doesn't wait the demo's full 90s.

const STAKE_LAMPORTS = new BN(0.1 * LAMPORTS_PER_SOL); // 100_000_000
const DURATION_SECS = 5; // short window for tests (demo uses 90)

describe("water_break", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.WaterBreak as Program<WaterBreak>;
  const admin = provider.wallet; // round authority

  // Unique round id per run so re-runs against a persistent validator don't collide.
  const roundId = new BN(Date.now());

  const fanWinner = Keypair.generate(); // bets the winning option (0)
  const fanLoser = Keypair.generate(); // bets a losing option (1)

  const roundIdLe = roundId.toArrayLike(Buffer, "le", 8);
  const [roundPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), roundIdLe],
    program.programId
  );

  const betPda = (fan: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), roundPda.toBuffer(), fan.toBuffer()],
      program.programId
    )[0];

  before(async () => {
    // Fund the two fan wallets on localnet.
    for (const fan of [fanWinner, fanLoser]) {
      const sig = await provider.connection.requestAirdrop(
        fan.publicKey,
        1 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig, "confirmed");
    }
  });

  it("initializes a round", async () => {
    await program.methods
      .initializeRound(
        roundId,
        "Brazil scores next",
        "France scores next",
        "No goal this break",
        new BN(DURATION_SECS)
      )
      .accounts({
        authority: admin.publicKey,
        round: roundPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const round = await program.account.round.fetch(roundPda);
    assert.strictEqual(round.roundId.toString(), roundId.toString());
    assert.strictEqual(round.resolved, false);
    assert.strictEqual(round.winningOption, 255);
    assert.strictEqual(round.totalPool.toNumber(), 0);
    assert.strictEqual(round.options[0], "Brazil scores next");
  });

  it("accepts predictions from two fans", async () => {
    // Winner stakes on option 0.
    await program.methods
      .placeBet(0, STAKE_LAMPORTS)
      .accounts({
        better: fanWinner.publicKey,
        round: roundPda,
        bet: betPda(fanWinner.publicKey),
        systemProgram: SystemProgram.programId,
      })
      .signers([fanWinner])
      .rpc();

    // Loser stakes on option 1.
    await program.methods
      .placeBet(1, STAKE_LAMPORTS)
      .accounts({
        better: fanLoser.publicKey,
        round: roundPda,
        bet: betPda(fanLoser.publicKey),
        systemProgram: SystemProgram.programId,
      })
      .signers([fanLoser])
      .rpc();

    const round = await program.account.round.fetch(roundPda);
    assert.strictEqual(round.totalPool.toString(), STAKE_LAMPORTS.muln(2).toString());
    assert.strictEqual(round.optionPools[0].toString(), STAKE_LAMPORTS.toString());
    assert.strictEqual(round.optionPools[1].toString(), STAKE_LAMPORTS.toString());
    assert.strictEqual(round.betCount, 2);
  });

  it("rejects resolve before the deadline", async () => {
    try {
      await program.methods
        .resolveRound(0)
        .accounts({ authority: admin.publicKey, round: roundPda })
        .rpc();
      assert.fail("resolve should have failed before deadline");
    } catch (err) {
      assert.match(err.toString(), /BettingStillOpen/);
    }
  });

  it("resolves the round after the deadline", async () => {
    // Wait past the deadline.
    await new Promise((r) => setTimeout(r, (DURATION_SECS + 2) * 1000));

    await program.methods
      .resolveRound(0)
      .accounts({ authority: admin.publicKey, round: roundPda })
      .rpc();

    const round = await program.account.round.fetch(roundPda);
    assert.strictEqual(round.resolved, true);
    assert.strictEqual(round.winningOption, 0);
  });

  it("pays the winner their full proportional share", async () => {
    const before = await provider.connection.getBalance(fanWinner.publicKey);

    await program.methods
      .claimWinnings()
      .accounts({
        better: fanWinner.publicKey,
        round: roundPda,
        bet: betPda(fanWinner.publicKey),
      })
      .signers([fanWinner])
      .rpc();

    const after = await provider.connection.getBalance(fanWinner.publicKey);

    // Only winner staked on option 0, so they take the entire pool (0.2 SOL),
    // minus the tx fee for the claim. Net gain ~ +0.2 - their original 0.1 = +0.1.
    const gain = after - before;
    // Winner gets total_pool (0.2 SOL) back; net of fees this is comfortably > 0.19 SOL.
    assert.isAbove(gain, 0.19 * LAMPORTS_PER_SOL, "winner should receive the full pool");

    const bet = await program.account.bet.fetch(betPda(fanWinner.publicKey));
    assert.strictEqual(bet.claimed, true);
  });

  it("rejects a double claim", async () => {
    try {
      await program.methods
        .claimWinnings()
        .accounts({
          better: fanWinner.publicKey,
          round: roundPda,
          bet: betPda(fanWinner.publicKey),
        })
        .signers([fanWinner])
        .rpc();
      assert.fail("double claim should fail");
    } catch (err) {
      assert.match(err.toString(), /AlreadyClaimed/);
    }
  });

  it("rejects a claim from a losing prediction", async () => {
    try {
      await program.methods
        .claimWinnings()
        .accounts({
          better: fanLoser.publicKey,
          round: roundPda,
          bet: betPda(fanLoser.publicKey),
        })
        .signers([fanLoser])
        .rpc();
      assert.fail("loser claim should fail");
    } catch (err) {
      assert.match(err.toString(), /NotAWinner/);
    }
  });
});
```

## `anchor/scripts/init-round.ts`

```typescript
/**
 * Initialize the demo round on whatever cluster ANCHOR_PROVIDER_URL points at.
 * Run AFTER `anchor deploy`. Uses the exact shared constants from CONTRACT.md.
 *
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
 *   ANCHOR_WALLET=~/.config/solana/id.json \
 *   ROUND_ID=1 npx ts-node scripts/init-round.ts
 */
import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "../target/idl/water_break.json";

const ROUND_ID = new BN(process.env.ROUND_ID || "1");
// Shared constants — must match CONTRACT.md and the frontend exactly.
const OPTIONS: [string, string, string] = [
  "Brazil scores next",
  "France scores next",
  "No goal this break",
];
const DURATION_SECS = 90;

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = new Program(idl as anchor.Idl, provider);

  const [roundPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), ROUND_ID.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  // Idempotent: if the round already exists, just report it.
  const existing = await provider.connection.getAccountInfo(roundPda);
  if (existing) {
    console.log(`Round ${ROUND_ID} already initialized at ${roundPda.toBase58()}`);
    return;
  }

  const sig = await program.methods
    .initializeRound(ROUND_ID, OPTIONS[0], OPTIONS[1], OPTIONS[2], new BN(DURATION_SECS))
    .accountsPartial({
      authority: provider.wallet.publicKey,
      round: roundPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("✅ Round initialized");
  console.log("   round_id :", ROUND_ID.toString());
  console.log("   round PDA:", roundPda.toBase58());
  console.log("   authority:", provider.wallet.publicKey.toBase58());
  console.log("   tx       :", sig);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
```

## `anchor/scripts/deploy-devnet.sh`

```bash
#!/bin/bash
# Turnkey devnet bring-up for Water Break.
# Prereq: the deploy wallet (~/.config/solana/id.json) holds ~4 devnet SOL.
# Everything else (build, real program ID, IDL) is already in place.
set -e

export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
cd "$(dirname "$0")/.."

RPC="${RPC:-https://api.devnet.solana.com}"
ROUND_ID="${ROUND_ID:-1}"

echo "== balance =="
solana balance --url "$RPC"

echo "== deploy program to devnet =="
anchor deploy --provider.cluster devnet

echo "== initialize demo round (id=$ROUND_ID) =="
ANCHOR_PROVIDER_URL="$RPC" \
ANCHOR_WALLET="$HOME/.config/solana/id.json" \
ROUND_ID="$ROUND_ID" \
  npx ts-node scripts/init-round.ts

echo ""
echo "== DONE. In frontend/.env set: =="
echo "   VITE_PLACE_BET_MODE=anchor"
echo "   VITE_PROGRAM_ID=$(solana address -k target/deploy/water_break-keypair.json)"
echo "   VITE_ROUND_ID=$ROUND_ID"
```

## `frontend/package.json`

```json
{
  "name": "water-break",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@coral-xyz/anchor": "^0.32.1",
    "@solana/wallet-adapter-base": "^0.9.23",
    "@solana/wallet-adapter-react": "^0.15.35",
    "@solana/wallet-adapter-react-ui": "^0.9.34",
    "@solana/wallet-adapter-wallets": "^0.19.32",
    "@solana/web3.js": "^1.95.3",
    "buffer": "^6.0.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.1"
  },
  "overrides": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0"
  }
}
```

## `frontend/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Water Break — Live Prediction Market</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <!-- Display = Futura (native on macOS demo machine); Oswald is the
         condensed fallback for non-Mac. Metadata = Space Mono. -->
    <link
      href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Space+Mono:wght@400;700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## `frontend/vite.config.ts`

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Solana web3.js / Anchor expect Node's Buffer global in the browser.
export default defineConfig({
  plugins: [react()],
  define: {
    "process.env": {},
  },
  resolve: {
    alias: {
      buffer: "buffer",
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: { global: "globalThis" },
    },
  },
});
```

## `frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

## `frontend/.env`

```ini
# Water Break — frontend env. Backend-owned values are filled in below.
# Works RIGHT NOW in fallback mode. Flip two lines (see bottom) once the
# Anchor program is deployed to devnet.

VITE_SOLANA_NETWORK=devnet
# The public devnet endpoint (api.devnet.solana.com) is heavily rate-limited.
# This free, no-key endpoint is what the program was deployed through and is
# not throttled. Swap back to the public one if you prefer.
VITE_RPC_URL=https://solana-devnet.api.onfinality.io/public

# --- ACTIVE: anchor mode (real escrow program, live on devnet) ---
VITE_PLACE_BET_MODE=anchor
VITE_PROGRAM_ID=HR51P2C3CHrw76rdtgM181SdyKSMJmyKn8yZq85eGV6Z
VITE_ROUND_ID=1

# --- Fallback mode (plain devnet SOL transfer). To revert: set
#     VITE_PLACE_BET_MODE=fallback (treasury below is already set). ---
VITE_TREASURY_PUBKEY=2zLeShndJu31Aui1mhHHB1zsS7zQD52YNi1AhTMhmJjT
```

## `frontend/src/main.tsx`

```tsx
import { Buffer } from "buffer";
// Solana web3.js relies on Buffer existing globally in the browser.
(window as any).Buffer = Buffer;

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { SolanaWalletProvider } from "./lib/wallet";
import "./styles/theme.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SolanaWalletProvider>
      <App />
    </SolanaWalletProvider>
  </React.StrictMode>
);
```

## `frontend/src/App.tsx`

```tsx
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
```

## `frontend/src/lib/program.ts`

```typescript
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, BN, type Wallet } from "@coral-xyz/anchor";
import idlJson from "../idl/water_break.json";
import type { WaterBreak } from "../idl/water_break";

/**
 * Two ways to wire this up, ranked by how much time you have left:
 *
 * 1. FULL ANCHOR PROGRAM (best, matches the pitch exactly).
 *    After `anchor build && anchor deploy` you'll have:
 *      - a real program ID (copy it into VITE_PROGRAM_ID and into
 *        anchor/programs/water_break/src/lib.rs's declare_id!)
 *      - anchor/target/idl/water_break.json
 *    Load the IDL with @coral-xyz/anchor's Program class and call
 *    place_bet / resolve_round / claim_winnings directly. See the
 *    commented-out `placeBetOnChain` stub below for the shape.
 *
 * 2. FALLBACK (use if you're short on time before judging):
 *    `placeBetFallback` below sends a REAL devnet SOL transfer from the
 *    fan's Phantom wallet to a treasury pubkey. It's not the full escrow
 *    contract, but it IS a real signed, on-chain, Explorer-verifiable
 *    Solana transaction — enough to prove "Solana-native" to judges while
 *    the rest of the UI runs on the live-feeling mock pool/feed/leaderboard.
 *
 * Swap PLACE_BET_MODE below once you know which path you're running.
 */
export const PLACE_BET_MODE: "anchor" | "fallback" =
  (import.meta.env.VITE_PLACE_BET_MODE as "anchor" | "fallback") || "fallback";

// ⚠️ Placeholder only (Solana's System Program address) — this will NOT work
// for a real demo. Set VITE_TREASURY_PUBKEY in .env to a devnet wallet you
// control before staking any real SOL, or every "bet" silently goes nowhere.
export const TREASURY_PUBKEY = new PublicKey(
  import.meta.env.VITE_TREASURY_PUBKEY || "11111111111111111111111111111111"
);

export const PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID
  ? new PublicKey(import.meta.env.VITE_PROGRAM_ID as string)
  : new PublicKey((idlJson as { address: string }).address);

// Which on-chain round the frontend predicts on. Must match the round the admin
// created via initialize_round on devnet. Override with VITE_ROUND_ID if needed.
export const DEMO_ROUND_ID = new BN(
  (import.meta.env.VITE_ROUND_ID as string) || "1"
);

export function explorerTxUrl(signature: string, network = "devnet") {
  return `https://explorer.solana.com/tx/${signature}?cluster=${network}`;
}

export function explorerAddressUrl(address: string, network = "devnet") {
  return `https://explorer.solana.com/address/${address}?cluster=${network}`;
}

/** Real devnet transfer: fan stakes `amountSol` SOL via Phantom. */
export async function placeBetFallback(
  connection: Connection,
  wallet: WalletContextState,
  amountSol: number
): Promise<string> {
  if (!wallet.publicKey || !wallet.sendTransaction) {
    throw new Error("Connect Phantom first.");
  }

  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: TREASURY_PUBKEY,
      lamports,
    })
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;

  const signature = await wallet.sendTransaction(tx, connection);
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}

// ---------------------------------------------------------------------------
// Anchor mode — the real escrow program.
// Active when VITE_PLACE_BET_MODE="anchor". Mirrors lib.rs exactly.
// ---------------------------------------------------------------------------

/** Build a typed Program client bound to the connected wallet. */
export function getProgram(
  connection: Connection,
  wallet: WalletContextState
): Program<WaterBreak> {
  // wallet-adapter's WalletContextState satisfies Anchor's Wallet interface
  // (publicKey + signTransaction + signAllTransactions) once connected.
  const provider = new AnchorProvider(connection, wallet as unknown as Wallet, {
    commitment: "confirmed",
  });
  // Anchor 0.30+: program ID is read from idl.address; no separate arg.
  return new Program(idlJson as unknown as WaterBreak, provider);
}

/** Round PDA: seeds ["round", round_id as u64 LE]. */
export function deriveRoundPda(roundId: BN = DEMO_ROUND_ID): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), roundId.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
  return pda;
}

/** Bet PDA: seeds ["bet", round_pda, wallet]. One bet account per fan per round. */
export function deriveBetPda(roundPda: PublicKey, wallet: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), roundPda.toBuffer(), wallet.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

/**
 * Real on-chain stake. Fan signs a place_bet that moves `amountSol` into the
 * round PDA vault. Returns the transaction signature (Explorer-verifiable),
 * same contract as placeBetFallback so App.tsx can swap them by mode.
 */
export async function placeBetOnChain(
  connection: Connection,
  wallet: WalletContextState,
  option: number,
  amountSol: number,
  roundId: BN = DEMO_ROUND_ID
): Promise<string> {
  if (!wallet.publicKey) throw new Error("Connect Phantom first.");

  const program = getProgram(connection, wallet);
  const roundPda = deriveRoundPda(roundId);
  const betPda = deriveBetPda(roundPda, wallet.publicKey);
  const lamports = new BN(Math.round(amountSol * LAMPORTS_PER_SOL));

  return program.methods
    .placeBet(option, lamports)
    .accountsPartial({
      better: wallet.publicKey,
      round: roundPda,
      bet: betPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

/** Winner claims their proportional share. Call once per winning fan after resolve. */
export async function claimWinningsOnChain(
  connection: Connection,
  wallet: WalletContextState,
  roundId: BN = DEMO_ROUND_ID
): Promise<string> {
  if (!wallet.publicKey) throw new Error("Connect Phantom first.");

  const program = getProgram(connection, wallet);
  const roundPda = deriveRoundPda(roundId);
  const betPda = deriveBetPda(roundPda, wallet.publicKey);

  return program.methods
    .claimWinnings()
    .accountsPartial({ better: wallet.publicKey, round: roundPda, bet: betPda })
    .rpc();
}

/** Admin only — create the round. Run once on devnet before fans can predict. */
export async function initializeRoundOnChain(
  connection: Connection,
  wallet: WalletContextState,
  optionA: string,
  optionB: string,
  optionC: string,
  durationSecs: number,
  roundId: BN = DEMO_ROUND_ID
): Promise<string> {
  if (!wallet.publicKey) throw new Error("Connect Phantom first.");

  const program = getProgram(connection, wallet);
  const roundPda = deriveRoundPda(roundId);

  return program.methods
    .initializeRound(roundId, optionA, optionB, optionC, new BN(durationSecs))
    .accountsPartial({
      authority: wallet.publicKey,
      round: roundPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

/** Admin only — lock in the winning option after the deadline passes. */
export async function resolveRoundOnChain(
  connection: Connection,
  wallet: WalletContextState,
  winningOption: number,
  roundId: BN = DEMO_ROUND_ID
): Promise<string> {
  if (!wallet.publicKey) throw new Error("Connect Phantom first.");

  const program = getProgram(connection, wallet);
  const roundPda = deriveRoundPda(roundId);

  return program.methods
    .resolveRound(winningOption)
    .accountsPartial({ authority: wallet.publicKey, round: roundPda })
    .rpc();
}

/**
 * Reads the live Round account directly off devnet. Works with no wallet
 * connected (read-only, no signing involved) — this is what makes the pool
 * size and percentages genuinely shared across every device watching the
 * same round, instead of each browser simulating its own fake numbers.
 * Returns null if initialize_round hasn't been run yet, so callers can fall
 * back to the mock feed instead of throwing.
 */
export async function fetchOnChainRound(connection: Connection, wallet: WalletContextState, roundId: BN = DEMO_ROUND_ID) {
  try {
    const program = getProgram(connection, wallet);
    const roundPda = deriveRoundPda(roundId);
    const account = await program.account.round.fetch(roundPda);
    return { roundPda, account };
  } catch {
    return null;
  }
}

/**
 * Maps the on-chain Round account onto the same shape mockData.RoundState
 * uses, so every component downstream stays unaware of which mode it's in.
 * `meta` covers fields the contract doesn't store (team names, the cosmetic
 * match clock) — pass through whatever's already showing so they don't
 * flicker on every poll.
 */
export function roundAccountToState(
  // Anchor types fixed-size arrays as `T[]`, not tuples — accept that and
  // narrow to the [a,b,c] shape RoundState expects below.
  account: { roundId: BN; options: string[]; deadline: BN; resolved: boolean; winningOption: number; optionPools: BN[]; totalPool: BN; betCount: number },
  meta: { teamA: string; teamB: string; matchClock: string }
) {
  const optionPoolsSol = account.optionPools.map((n) => n.toNumber() / LAMPORTS_PER_SOL) as [number, number, number];

  return {
    roundId: account.roundId.toNumber(),
    teamA: meta.teamA,
    teamB: meta.teamB,
    options: account.options as [string, string, string],
    matchClock: meta.matchClock,
    deadlineMs: account.deadline.toNumber() * 1000,
    totalPoolSol: account.totalPool.toNumber() / LAMPORTS_PER_SOL,
    optionPoolsSol,
    participantCount: account.betCount,
    resolved: account.resolved,
    winningOption: (account.resolved ? account.winningOption : null) as 0 | 1 | 2 | null,
  };
}
```

## `frontend/src/lib/wallet.tsx`

```tsx
import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

// Default wallet adapter UI styles. If this import errors, run:
// npm install @solana/wallet-adapter-react-ui  (then restart the dev server)
import "@solana/wallet-adapter-react-ui/styles.css";

export const NETWORK = (import.meta.env.VITE_SOLANA_NETWORK as
  | "devnet"
  | "mainnet-beta"
  | "testnet") ?? "devnet";

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(
    () => import.meta.env.VITE_RPC_URL || clusterApiUrl(NETWORK),
    []
  );
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

## `frontend/src/lib/mockData.ts`

```typescript
// Mock-data layer so the demo always looks alive even if devnet is flaky
// or the program isn't deployed yet. Swap calls in lib/program.ts to real
// on-chain reads once `anchor deploy` gives you a program ID + IDL.

export type OptionKey = 0 | 1 | 2;

export interface RoundState {
  roundId: number;
  teamA: string;
  teamB: string;
  options: [string, string, string]; // [teamA scores, teamB scores, no goal]
  matchClock: string;
  deadlineMs: number; // epoch ms when betting closes
  totalPoolSol: number;
  optionPoolsSol: [number, number, number];
  participantCount: number;
  resolved: boolean;
  winningOption: OptionKey | null;
}

export interface ActivityItem {
  id: string;
  wallet: string;
  option: OptionKey;
  ts: number;
}

export interface LeaderboardEntry {
  wallet: string;
  payoutSol: number;
}

export function shortWallet(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function randomFakeWallet(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 44; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function initialMockRound(): RoundState {
  return {
    roundId: 1,
    teamA: "Brazil",
    teamB: "France",
    options: ["Brazil scores next", "France scores next", "No goal this break"],
    matchClock: "72:00",
    deadlineMs: Date.now() + 90_000,
    totalPoolSol: 4.8,
    optionPoolsSol: [2.97, 1.34, 0.49],
    participantCount: 53,
    resolved: false,
    winningOption: null,
  };
}

export function initialActivity(): ActivityItem[] {
  const opts: OptionKey[] = [0, 1, 0, 0, 1, 2, 0];
  return opts.map((option, i) => ({
    id: `seed-${i}`,
    wallet: randomFakeWallet(),
    option,
    ts: Date.now() - (opts.length - i) * 4000,
  }));
}

export function mockLeaderboard(round: RoundState): LeaderboardEntry[] {
  if (round.winningOption === null) return [];
  const winnerCount = Math.max(3, Math.round(round.participantCount * 0.3));
  const winningPool = round.optionPoolsSol[round.winningOption] || 1;
  const perWinnerStake = winningPool / winnerCount;
  const payout = (perWinnerStake / winningPool) * round.totalPoolSol;
  return Array.from({ length: Math.min(winnerCount, 8) }, () => ({
    wallet: randomFakeWallet(),
    payoutSol: Number(payout.toFixed(2)),
  })).sort((a, b) => b.payoutSol - a.payoutSol);
}
```

## `frontend/src/styles/theme.css`

```css
/* ============================================================
   WATER BREAK — flat color-block design system
   Reference: 2020s Nike / New Balance streetwear campaign graphics
   with 2000s football energy. Bold flat color blocking, oversized
   condensed display caps, ticket/boarding-pass utility type.
   No gradients. No glow. No chrome. Hard-edge offset shadows only.
   ============================================================ */

:root {
  /* New canonical palette */
  --ink: #111111;
  --paper: #f4eee1;
  --yellow: #f4e04d;
  --orange: #e8501f;
  --red: #e8341f;
  --navy: #0b2b3c;
  --lavender: #8b7fd6;

  /* Legacy var names kept as aliases so existing inline styles still
     resolve — remapped onto the new flat palette. */
  --wb-yellow: var(--yellow);
  --wb-yellow-deep: #d8c43a;
  --wb-green: var(--navy);
  --wb-green-deep: #06202c;
  --wb-blue: var(--lavender);
  --wb-orange: var(--orange);
  --wb-pink: var(--red);
  --wb-ink: var(--ink);
  --wb-paper: var(--paper);
  --wb-chrome-1: var(--paper);
  --wb-chrome-2: #c9c2b2;
  --wb-chrome-3: #6f6a5d;

  --wb-font-display: "Futura PT", "Futura", "Oswald", "Helvetica Neue", Arial, sans-serif;
  --wb-font-head: "Futura PT", "Futura", "Oswald", "Helvetica Neue", Arial, sans-serif;
  --wb-font-mono: "Space Mono", "IBM Plex Mono", monospace;

  --wb-radius: 3px;
  --wb-shadow-pop: 6px 6px 0 var(--ink);
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  min-height: 100%;
}

body {
  font-family: var(--wb-font-head);
  color: var(--ink);
  background: var(--paper);
  background-attachment: fixed;
  overflow-x: hidden;
}

/* Page container — flat paper, no texture overlay anymore. */
.wb-halftone::before {
  content: none;
}

/* Barcode strip — thin black bars, used sparingly (the ticket motif). */
.wb-stripes {
  background-image: repeating-linear-gradient(
    90deg,
    var(--ink) 0px,
    var(--ink) 2px,
    transparent 2px,
    transparent 5px
  );
}

/* Display headline — flat bold caps, tight tracking. No gradient. */
.wb-chrome-text {
  font-family: var(--wb-font-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  line-height: 0.95;
  color: inherit;
}

/* Default card = flat dark color block with a hard offset shadow. */
.wb-card {
  background: var(--ink);
  color: var(--paper);
  border: 2px solid var(--ink);
  border-radius: var(--wb-radius);
  box-shadow: var(--wb-shadow-pop);
}

.wb-btn {
  font-family: var(--wb-font-display);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  border: 2px solid var(--ink);
  border-radius: var(--wb-radius);
  padding: 14px 26px;
  cursor: pointer;
  color: var(--paper);
  background: var(--orange);
  box-shadow: 4px 4px 0 var(--ink);
  transition: transform 0.06s ease, box-shadow 0.06s ease;
}

.wb-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 5px 5px 0 var(--ink);
}

.wb-btn:active {
  transform: translate(4px, 4px);
  box-shadow: 0 0 0 var(--ink);
}

.wb-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: 2px 2px 0 var(--ink);
}

.wb-btn--outline {
  background: var(--paper);
  color: var(--ink);
  border: 2px solid var(--ink);
  box-shadow: 4px 4px 0 var(--ink);
}

.wb-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--wb-font-mono);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  padding: 4px 9px;
  border-radius: 0;
  background: var(--ink);
  color: var(--paper);
}

/* Live indicator — flat red square, blinks via opacity (no glow). */
.wb-live-dot {
  width: 9px;
  height: 9px;
  border-radius: 0;
  background: var(--red);
  animation: wb-blink 1s steps(2, start) infinite;
}

@keyframes wb-blink {
  50% {
    opacity: 0.25;
  }
}

.wb-scoreboard-digits {
  font-family: var(--wb-font-mono);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

@keyframes wb-confetti-fall {
  0% {
    transform: translateY(-10vh) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(110vh) rotate(540deg);
    opacity: 0.9;
  }
}

.wb-confetti-piece {
  position: fixed;
  top: 0;
  width: 12px;
  height: 12px;
  pointer-events: none;
  animation: wb-confetti-fall linear forwards;
  z-index: 50;
}

@keyframes wb-pop-in {
  0% {
    transform: translateY(6px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

.wb-pop-in {
  animation: wb-pop-in 0.22s ease-out;
}

.wb-progress-track {
  height: 10px;
  border-radius: 0;
  background: rgba(244, 238, 225, 0.18);
  border: 1px solid rgba(244, 238, 225, 0.25);
  overflow: hidden;
}

.wb-progress-fill {
  height: 100%;
  border-radius: 0;
  transition: width 0.4s ease;
}
```

## `frontend/src/components/MatchHeader.tsx`

```tsx
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
```

## `frontend/src/components/WaterBreakTimer.tsx`

```tsx
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
```

## `frontend/src/components/PrizePool.tsx`

```tsx
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
```

## `frontend/src/components/PredictionPanel.tsx`

```tsx
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
```

## `frontend/src/components/CommunityStats.tsx`

```tsx
import type { RoundState } from "../lib/mockData";

const COLORS = ["var(--wb-yellow)", "var(--wb-blue)", "var(--wb-pink)"];

export function CommunityStats({ round }: { round: RoundState }) {
  const total = round.optionPoolsSol.reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="wb-card wb-pop-in" style={{ padding: "20px 24px" }}>
      <div style={{ fontFamily: "var(--wb-font-mono)", fontSize: 12, opacity: 0.7, marginBottom: 10, textTransform: "uppercase" }}>
        Community predictions
      </div>
      {round.options.map((label, i) => {
        const pct = Math.round((round.optionPoolsSol[i] / total) * 100);
        return (
          <div key={label} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
              <span>{label}</span>
              <span className="wb-scoreboard-digits">{pct}%</span>
            </div>
            <div className="wb-progress-track">
              <div className="wb-progress-fill" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

## `frontend/src/components/ActivityFeed.tsx`

```tsx
import type { ActivityItem, RoundState } from "../lib/mockData";
import { shortWallet } from "../lib/mockData";

export function ActivityFeed({ items, round }: { items: ActivityItem[]; round: RoundState }) {
  return (
    <div className="wb-card wb-pop-in" style={{ padding: "20px 24px", maxHeight: 220, overflowY: "auto" }}>
      <div style={{ fontFamily: "var(--wb-font-mono)", fontSize: 12, opacity: 0.7, marginBottom: 10, textTransform: "uppercase" }}>
        Live activity
      </div>
      {items.slice(0, 8).map((item) => (
        <div
          key={item.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            fontFamily: "var(--wb-font-mono)",
            padding: "6px 0",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <span>
            {shortWallet(item.wallet)} joined <strong>{round.options[item.option]}</strong>
          </span>
          <span style={{ opacity: 0.5 }}>{timeAgo(item.ts)}</span>
        </div>
      ))}
    </div>
  );
}

function timeAgo(ts: number) {
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  return secs < 1 ? "now" : `${secs}s ago`;
}
```

## `frontend/src/components/Leaderboard.tsx`

```tsx
import type { LeaderboardEntry } from "../lib/mockData";
import { shortWallet } from "../lib/mockData";

const MEDALS = ["🥇", "🥈", "🥉"];

export function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="wb-card wb-pop-in" style={{ padding: "20px 24px" }}>
      <div className="wb-chrome-text" style={{ fontSize: 22, marginBottom: 12 }}>
        🏆 Winners
      </div>
      {entries.map((entry, i) => (
        <div
          key={entry.wallet}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 0",
            fontFamily: "var(--wb-font-mono)",
            borderBottom: i < entries.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
          }}
        >
          <span>
            {MEDALS[i] ?? `${i + 1}.`} {shortWallet(entry.wallet)}
          </span>
          <span style={{ color: "var(--wb-yellow)", fontWeight: 700 }}>+{entry.payoutSol.toFixed(2)} SOL</span>
        </div>
      ))}
    </div>
  );
}
```

## `frontend/src/components/AchievementBadge.tsx`

```tsx
export function AchievementBadge({ show, staked }: { show: boolean; staked: boolean }) {
  if (!show) return null;

  return (
    <div
      className="wb-pop-in"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 20px",
        borderRadius: "var(--wb-radius)",
        background: "var(--yellow)",
        color: "var(--ink)",
        border: "2px solid var(--ink)",
        boxShadow: "var(--wb-shadow-pop)",
      }}
    >
      <div style={{ fontSize: 36 }}>🏅</div>
      <div>
        <div className="wb-chrome-text" style={{ fontSize: 22 }}>PREDICTION MASTER</div>
        <div style={{ fontFamily: "var(--wb-font-mono)", fontSize: 12, opacity: 0.75 }}>
          {staked ? "Achievement unlocked · staked SOL and called it right" : "Achievement unlocked · called it right, free pick"}
        </div>
      </div>
    </div>
  );
}
```

## `frontend/src/components/ExplorerLink.tsx`

```tsx
export function ExplorerLink({ signature }: { signature: string | null }) {
  if (!signature) return null;

  const url = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="wb-tag wb-pop-in"
      style={{ background: "var(--wb-green)", color: "#eafff0", textDecoration: "none" }}
    >
      ✅ Confirmed on Solana · view on Explorer ↗
    </a>
  );
}
```

## `frontend/src/components/Confetti.tsx`

```tsx
import { useMemo } from "react";

const COLORS = ["#F4E04D", "#E8501F", "#E8341F", "#0B2B3C", "#8B7FD6"];

export function Confetti({ active }: { active: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.2 + Math.random() * 1.4,
        color: COLORS[i % COLORS.length],
        rotate: Math.random() * 360,
      })),
    [active]
  );

  if (!active) return null;

  return (
    <>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="wb-confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </>
  );
}
```
