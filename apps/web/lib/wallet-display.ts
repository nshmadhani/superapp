import {
  cleanWalletName,
  walletDisplayName as coreDisplayName,
} from "@cipher/core";

export { cleanWalletName };

export function walletDisplayName(w: {
  label?: string | null;
  source?: string;
}): string {
  return coreDisplayName(w);
}

/** Disambiguate duplicate display names with a short chain tag. */
export function walletSelectLabel(
  w: {
    id: string;
    label?: string | null;
    source?: string;
    chainFamily?: string;
    address: string;
  },
  peers: Array<{ id: string; label?: string | null; source?: string }>,
): string {
  const base = walletDisplayName(w);
  const dupes = peers.filter((p) => walletDisplayName(p) === base).length;
  if (dupes <= 1) return base;
  const chain =
    w.chainFamily === "solana"
      ? "Solana"
      : w.chainFamily === "evm"
        ? "EVM"
        : "";
  return chain ? `${base} (${chain})` : base;
}

export function addressesMatch(a: string, b: string): boolean {
  if (a.startsWith("0x") || b.startsWith("0x")) {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}
