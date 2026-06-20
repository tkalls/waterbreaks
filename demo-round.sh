#!/bin/bash
# Spin a FRESH short round for a live local demo and point the dev server at it.
# Usage:  ./demo-round.sh [duration_seconds]   (default 180)
set -e
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
ROOT="$(cd "$(dirname "$0")" && pwd)"
RPC="https://solana-devnet.api.onfinality.io/public"
DUR="${1:-180}"
RID=$(date +%s)   # unique round id

cd "$ROOT/anchor"
ANCHOR_PROVIDER_URL="$RPC" ANCHOR_WALLET="$HOME/.config/solana/id.json" ROUND_ID="$RID" DURATION_SECS="$DUR" \
  npx ts-node --compiler-options '{"resolveJsonModule":true,"esModuleInterop":true}' scripts/init-round.ts

# point the LOCAL dev server at the new round (Vite auto-reloads on .env change)
cd "$ROOT/frontend"
sed -i '' "s/^VITE_ROUND_ID=.*/VITE_ROUND_ID=$RID/" .env
echo ""
echo "✅ Fresh demo round $RID live for ${DUR}s. Refresh the page — timer now counts down."
