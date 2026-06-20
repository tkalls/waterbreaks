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
