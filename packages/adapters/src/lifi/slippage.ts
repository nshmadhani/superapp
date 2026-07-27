/**
 * LI.FI / Relay slippage for cross-chain bridges.
 * Small USD sizes (gas top-ups ~$1–5) often fail with default 0.5% — Relay
 * refunds with failReason=SLIPPAGE. Use a wider tolerance for those.
 */
export function recommendLifiSlippage(opts: {
  fromChainId: number;
  toChainId: number;
  /** USD notional of the send, when known */
  amountUsd?: number | null;
  /** Explicit override from the agent (0–1, e.g. 0.03 = 3%) */
  requested?: number | null;
}): { slippage: number; reason: string; bumped: boolean } {
  if (
    opts.requested != null &&
    Number.isFinite(opts.requested) &&
    opts.requested > 0 &&
    opts.requested <= 0.5
  ) {
    return {
      slippage: opts.requested,
      reason: "agent_requested",
      bumped: false,
    };
  }

  const cross = opts.fromChainId !== opts.toChainId;
  const usd = opts.amountUsd;
  if (cross && usd != null && Number.isFinite(usd)) {
    if (usd < 5) {
      return {
        slippage: 0.05,
        reason: "cross_chain_under_5_usd",
        bumped: true,
      };
    }
    if (usd < 25) {
      return {
        slippage: 0.03,
        reason: "cross_chain_under_25_usd",
        bumped: true,
      };
    }
  }

  // Cross-chain with unknown USD (typical gas top-up quotes): prefer 3%.
  if (cross && (usd == null || !Number.isFinite(usd))) {
    return {
      slippage: 0.03,
      reason: "cross_chain_usd_unknown",
      bumped: true,
    };
  }

  return { slippage: 0.005, reason: "default", bumped: false };
}

/** Rough USD from LI.FI token priceUSD + human amount. */
export function estimateAmountUsd(
  amountBaseUnits: string,
  decimals: number | undefined,
  priceUsd: string | number | null | undefined,
): number | null {
  if (priceUsd == null || priceUsd === "") return null;
  const price = Number(priceUsd);
  const dec = decimals ?? 18;
  if (!Number.isFinite(price) || price <= 0) return null;
  try {
    const raw = BigInt(amountBaseUnits);
    const whole = Number(raw) / 10 ** dec;
    if (!Number.isFinite(whole)) return null;
    return whole * price;
  } catch {
    return null;
  }
}
