import { describe, expect, it, vi } from "vitest";
import { agentRunStore } from "./store";
import { executeAgentRun } from "./worker";

vi.mock("./runners/dca", () => ({
  runDcaJob: vi.fn(async () => ({
    artifact: {
      kind: "dca",
      asset: "ETH",
      amountUsd: 50,
      cadence: "weekly",
      nextRunAt: "2026-07-27",
      legs: [{ date: "2026-07-27", amountUsd: 50 }],
      summary: "test",
    },
    source: "fallback" as const,
  })),
}));

describe("executeAgentRun", () => {
  it("runs a queued DCA job to succeeded", async () => {
    const run = agentRunStore.create({
      userId: "u1",
      type: "dca",
      goal: "DCA $50 of ETH weekly",
      policy: { asset: "ETH", amountUsd: 50, cadence: "weekly" },
      wallet: {
        cipherWalletId: "w1",
        address: "0xagent0000000000000000000000000000000001",
        chainFamily: "evm",
        label: "Agent · DCA · test01",
      },
    });
    const done = await executeAgentRun(run.id);
    expect(done?.status).toBe("succeeded");
    expect(done?.artifact?.kind).toBe("dca");
    expect(done?.source).toBe("fallback");
    expect(done?.wallet?.address).toMatch(/^0x/);
    expect(done?.artifact && "walletAddress" in done.artifact
      ? done.artifact.walletAddress
      : null).toBe(run.wallet?.address);
    expect(done?.steps.length).toBeGreaterThan(0);
  });
});
