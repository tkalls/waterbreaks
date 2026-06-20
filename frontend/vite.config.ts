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
