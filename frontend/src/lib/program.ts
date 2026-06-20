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
