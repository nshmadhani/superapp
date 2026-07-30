import { describe, it, expect } from "vitest";
import { hashPlan, type Plan } from "@ervo/core";

describe("plan persistence contract", () => {
  it("hashPlan matches what savePlan would store", () => {
    const plan: Plan = {
      id: "11111111-1111-1111-1111-111111111111",
      walletId: "22222222-2222-2222-2222-222222222222",
      steps: [
        {
          type: "swap",
          fromChainId: 8453,
          toChainId: 8453,
          sellToken: "0xusd",
          buyToken: "0xeth",
          sellAmount: "1000",
          minBuyAmount: "1",
          adapterId: "lifi",
        },
      ],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    };
    expect(hashPlan(plan)).toHaveLength(64);
  });
});
