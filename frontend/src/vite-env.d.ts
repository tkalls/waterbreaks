/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOLANA_NETWORK?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_PROGRAM_ID?: string;
  readonly VITE_TREASURY_PUBKEY?: string;
  readonly VITE_PLACE_BET_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
