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
