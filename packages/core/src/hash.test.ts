import { describe, it, expect } from "vitest";
import { hashPlan, type Plan } from "./plan";

describe("hashPlan", () => {
  it("is stable for the same plan and changes when amount changes", () => {
    const base: Plan = {
      id: "p1",
      walletId: "w1",
      steps: [
        {
          type: "swap",
          chainId: 8453,
          sellToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          buyToken: "0x4200000000000000000000000000000000000006",
          sellAmount: "1000000",
          minBuyAmount: "1",
          adapterId: "evm-swap",
        },
      ],
      createdAt: "2026-07-25T00:00:00.000Z",
      expiresAt: "2026-07-25T00:10:00.000Z",
    };
    const h1 = hashPlan(base);
    const h2 = hashPlan({
      ...base,
      steps: [{ ...base.steps[0]!, sellAmount: "2000000" }],
    });
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
    expect(h1).not.toEqual(h2);
  });
});
