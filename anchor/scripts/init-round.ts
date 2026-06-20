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
// Default 90s (the demo match window). Override with DURATION_SECS for a
// long-lived round so a hosted/judge URL stays interactive anytime.
const DURATION_SECS = Number(process.env.DURATION_SECS || "90");

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
