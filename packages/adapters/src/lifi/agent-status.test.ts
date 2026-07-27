import { describe, it, expect } from "vitest";
import { buildAgentLifiStatus } from "./agent-status";

describe("buildAgentLifiStatus", () => {
  it("matches get_lifi_status shape for refunds", () => {
    const s = buildAgentLifiStatus({
      txHash: "0xabc",
      status: "REFUNDED",
      uiStatus: "REFUNDED",
      rawStatus: "DONE",
      substatus: "REFUNDED",
      terminalKind: "refunded",
      tool: "relaydepository",
      failReason: "SLIPPAGE",
      sendingChainId: 999,
      receivingChainId: 999,
    });
    expect(s.type).toBe("lifi_status");
    expect(s.terminalKind).toBe("refunded");
    expect(s.failReason).toBe("SLIPPAGE");
    expect(s.guidance).toMatch(/slippage/i);
  });
});
