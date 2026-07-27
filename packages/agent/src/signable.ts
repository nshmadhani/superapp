/** Normalize for comparison: EVM lowercased, Solana as-is. */
export function normalizeSignableAddress(address: string): string {
  const a = address.trim();
  return a.startsWith("0x") ? a.toLowerCase() : a;
}

export function toSignableSet(
  addresses: string[] | undefined | null,
): Set<string> | null {
  if (addresses == null) return null;
  return new Set(addresses.map(normalizeSignableAddress).filter(Boolean));
}

export function isAddressSignable(
  signable: Set<string> | null,
  address: string,
): boolean | null {
  if (!signable) return null; // unknown — client didn't send live set
  return signable.has(normalizeSignableAddress(address));
}
