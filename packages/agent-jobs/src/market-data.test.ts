import { describe, expect, it } from "vitest";
import { resolveBinanceSymbol } from "./market-data";

describe("resolveBinanceSymbol", () => {
  it("maps common tickers", () => {
    expect(resolveBinanceSymbol("ETH")).toBe("ETHUSDT");
    expect(resolveBinanceSymbol("bitcoin")).toBe("BTCUSDT");
    expect(resolveBinanceSymbol("sol")).toBe("SOLUSDT");
  });

  it("passes through *USDT pairs", () => {
    expect(resolveBinanceSymbol("ethusdt")).toBe("ETHUSDT");
  });
});
