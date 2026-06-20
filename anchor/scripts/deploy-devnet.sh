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
