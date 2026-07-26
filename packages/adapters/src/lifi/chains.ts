/** LI.FI chain id for Solana mainnet */
export const LIFI_SOLANA_CHAIN_ID = 1151111081099710;

export function isLifiSolanaChain(chainId: number): boolean {
  return chainId === LIFI_SOLANA_CHAIN_ID;
}

export function isLifiEvmChain(chainId: number): boolean {
  return Number.isFinite(chainId) && chainId > 0 && !isLifiSolanaChain(chainId);
}

export function chainFamilyForLifiChain(
  chainId: number,
): "evm" | "solana" | null {
  if (isLifiSolanaChain(chainId)) return "solana";
  if (isLifiEvmChain(chainId)) return "evm";
  return null;
}

export function defaultLifiChainForFamily(
  family: "evm" | "solana",
): number {
  return family === "solana" ? LIFI_SOLANA_CHAIN_ID : 8453;
}
