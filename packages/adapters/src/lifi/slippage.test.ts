import { describe, it, expect } from "vitest";
import { recommendLifiSlippage, estimateAmountUsd } from "./slippage";

describe("recommendLifiSlippage", () => {
  it("widens slippage for small cross-chain USD", () => {
    expect(
      recommendLifiSlippage({
        fromChainId: 999,
        toChainId: 8453,
        amountUsd: 2,
      }).slippage,
    ).toBe(0.05);
    expect(
      recommendLifiSlippage({
        fromChainId: 999,
        toChainId: 8453,
        amountUsd: 10,
      }).slippage,
    ).toBe(0.03);
  });

  it("keeps default for large or same-chain", () => {
    expect(
      recommendLifiSlippage({
        fromChainId: 999,
        toChainId: 8453,
        amountUsd: 100,
      }).slippage,
    ).toBe(0.005);
    expect(
      recommendLifiSlippage({
        fromChainId: 8453,
        toChainId: 8453,
        amountUsd: 2,
      }).slippage,
    ).toBe(0.005);
  });

  it("honors agent override", () => {
    expect(
      recommendLifiSlippage({
        fromChainId: 999,
        toChainId: 8453,
        amountUsd: 2,
        requested: 0.08,
      }).slippage,
    ).toBe(0.08);
  });
});

describe("estimateAmountUsd", () => {
  it("estimates from base units + price", () => {
    // 0.035 HYPE * $57 ≈ 2.0
    const usd = estimateAmountUsd("35000000000000000", 18, 57);
    expect(usd).toBeGreaterThan(1.9);
    expect(usd).toBeLessThan(2.1);
  });
});
