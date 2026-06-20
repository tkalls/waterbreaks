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
