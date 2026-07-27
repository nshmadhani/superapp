import { describe, it, expect } from "vitest";
import { normalizeLifiTerminal } from "./status-normalize";
import { resolveLifiToken, LIFI_NATIVE_TOKEN } from "./tokens";

describe("normalizeLifiTerminal", () => {
  it("treats DONE + REFUNDED as refunded (not success)", () => {
    const t = normalizeLifiTerminal({
      status: "DONE",
      substatus: "REFUNDED",
    });
    expect(t.kind).toBe("refunded");
    expect(t.uiStatus).toBe("REFUNDED");
  });

  it("keeps DONE + COMPLETED as success", () => {
    const t = normalizeLifiTerminal({
      status: "DONE",
      substatus: "COMPLETED",
    });
    expect(t.kind).toBe("success");
    expect(t.uiStatus).toBe("DONE");
  });
});

describe("resolveLifiToken", () => {
  it("maps HYPE on HyperEVM to native address", () => {
    expect(resolveLifiToken(999, "HYPE")).toBe(LIFI_NATIVE_TOKEN);
    expect(resolveLifiToken(999, "hype")).toBe(LIFI_NATIVE_TOKEN);
  });

  it("maps ETH on Base to native address, leaves ETH on HyperEVM as symbol", () => {
    expect(resolveLifiToken(8453, "ETH")).toBe(LIFI_NATIVE_TOKEN);
    // Not native on 999 — caller must use toChainId=8453 for Base gas
    expect(resolveLifiToken(999, "ETH")).toBe("ETH");
  });
});
