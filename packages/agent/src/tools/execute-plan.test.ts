import { describe, it, expect } from "vitest";
import { memoryStore } from "../memory-store";
import type { Plan } from "@ervo/core";
import { hashPlan } from "@ervo/core";

function samplePlan(walletId: string): Plan {
  return {
    id: crypto.randomUUID(),
    walletId,
    steps: [
      {
        type: "swap",
        fromChainId: 8453,
        toChainId: 8453,
        sellToken: "0xa",
        buyToken: "0xb",
        sellAmount: "1",
        minBuyAmount: "1",
        adapterId: "lifi",
      },
    ],
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    unsignedTx: {
      to: "0xrouter",
      data: "0xdead",
      value: "0",
      chainId: 8453,
      minBuyAmount: "1",
      displayRoute: "0xa -> 0xb",
    },
  };
}

describe("execute_plan confirm gate", () => {
  it("rejects missing confirm", () => {
    expect(() =>
      memoryStore.consumeConfirm("does-not-exist", "abc"),
    ).toThrow(/Invalid or expired/);
  });

  it("rejects consume before UI approval", () => {
    const walletId = crypto.randomUUID();
    const userId = "user-1";
    memoryStore.upsertWallet(userId, {
      id: walletId,
      address: "0xabc",
      chainFamily: "evm",
      source: "turnkey",
    });
    const plan = samplePlan(walletId);
    const { planId, planHash } = memoryStore.savePlan(userId, plan);
    const confirmId = memoryStore.createConfirm(
      planId,
      planHash,
      plan.expiresAt,
    );
    expect(() => memoryStore.consumeConfirm(confirmId, planHash)).toThrow(
      /not approved/,
    );
  });

  it("approves then consumes once", () => {
    const walletId = crypto.randomUUID();
    const userId = "user-1";
    memoryStore.upsertWallet(userId, {
      id: walletId,
      address: "0xabc",
      chainFamily: "evm",
      source: "turnkey",
    });
    const plan = samplePlan(walletId);
    const { planId, planHash } = memoryStore.savePlan(userId, plan);
    expect(planHash).toBe(hashPlan(plan));
    const confirmId = memoryStore.createConfirm(
      planId,
      planHash,
      plan.expiresAt,
    );
    const approved = memoryStore.approveConfirm(
      planId,
      confirmId,
      planHash,
      userId,
    );
    expect(approved.unsignedTx?.to).toBe("0xrouter");
    expect(memoryStore.consumeConfirm(confirmId, planHash)).toBe(planId);
    expect(() => memoryStore.consumeConfirm(confirmId, planHash)).toThrow();
  });
});
