import { describe, expect, it } from "vitest";
import { agentRunStore } from "./store";
import { reconcileAgentRun, shouldResumeAgentRun } from "./reconcile";

describe("reconcileAgentRun", () => {
  it("marks spend-complete live DCA as succeeded", () => {
    const run = agentRunStore.create({
      userId: "u1",
      type: "dca",
      goal: "buy every 10s",
      policy: { live: true, intervalSeconds: 10 },
      wallet: {
        address: "0x1111111111111111111111111111111111111111",
        chainFamily: "evm",
        label: "Agent",
        source: "ephemeral",
      },
    });
    agentRunStore.update(run.id, { status: "running" });
    agentRunStore.appendStep(run.id, {
      id: "s1",
      label: "Spend complete",
      status: "done",
      detail: "empty",
    });
    const out = reconcileAgentRun(run.id);
    expect(out?.status).toBe("succeeded");
    expect(shouldResumeAgentRun(out!)).toBe(false);
  });

  it("marks errored work step as failed", () => {
    const run = agentRunStore.create({
      userId: "u1",
      type: "ta",
      goal: "TA ETH",
    });
    agentRunStore.update(run.id, { status: "running" });
    agentRunStore.appendStep(run.id, {
      id: "s1",
      label: "Fetch OHLCV + analyze in E2B",
      status: "error",
      detail: "binance_klines_451",
    });
    const out = reconcileAgentRun(run.id);
    expect(out?.status).toBe("failed");
    expect(out?.error).toBe("binance_klines_451");
    expect(shouldResumeAgentRun(out!)).toBe(false);
  });
});
