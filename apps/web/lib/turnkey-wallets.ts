export type ChainFamily = "evm" | "solana";

export function addressFormatForChain(
  chain: ChainFamily,
): "ADDRESS_FORMAT_ETHEREUM" | "ADDRESS_FORMAT_SOLANA" {
  return chain === "evm"
    ? "ADDRESS_FORMAT_ETHEREUM"
    : "ADDRESS_FORMAT_SOLANA";
}

export function isEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/** Base58 Solana pubkey (32 bytes encoded ≈ 32–44 chars). */
export function isSolanaAddress(address: string): boolean {
  return (
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) && !isEvmAddress(address)
  );
}

export function chainFamilyForAddress(
  address: string,
): ChainFamily | null {
  if (isEvmAddress(address)) return "evm";
  if (isSolanaAddress(address)) return "solana";
  return null;
}
