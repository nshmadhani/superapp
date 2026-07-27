/** LI.FI native token address (EVM). */
export const LIFI_NATIVE_TOKEN =
  "0x0000000000000000000000000000000000000000";

/** Native gas symbol per LI.FI chain id. */
const NATIVE_SYMBOL_BY_CHAIN: Record<number, string> = {
  1: "ETH",
  8453: "ETH",
  42161: "ETH",
  999: "HYPE",
  1151111081099710: "SOL",
};

/**
 * Resolve a user/agent token (symbol or address) to a LI.FI quote token id.
 * Native symbols on the given chain become the zero address so we never
 * accidentally hit a same-named ERC20 (e.g. "ETH" on HyperEVM ≠ Base ETH).
 */
export function resolveLifiToken(
  chainId: number,
  token: string,
): string {
  const raw = token.trim();
  if (!raw) return raw;
  if (raw.startsWith("0x") || raw.length > 20) return raw;

  const sym = raw.toUpperCase();
  const native = NATIVE_SYMBOL_BY_CHAIN[chainId];
  if (native && sym === native) return LIFI_NATIVE_TOKEN;

  // Solana wrapped SOL mint is also accepted as SOL by LI.FI; keep symbol.
  return raw;
}

export function nativeSymbolForChain(chainId: number): string | undefined {
  return NATIVE_SYMBOL_BY_CHAIN[chainId];
}
