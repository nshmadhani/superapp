import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@lifi/sdk", () => ({
  createClient: vi.fn(() => ({})),
  getQuote: vi.fn(),
  convertQuoteToRoute: vi.fn((step) => ({
    id: "route-1",
    steps: [step],
  })),
}));

import { getQuote } from "@lifi/sdk";
import { quoteLifiTransfer } from "./quote";
import { resetLifiClientForTests } from "./client";

describe("quoteLifiTransfer", () => {
  beforeEach(() => {
    resetLifiClientForTests();
    vi.mocked(getQuote).mockReset();
  });

  it("maps a LiFi quote into Cipher review fields", async () => {
    vi.mocked(getQuote).mockResolvedValue({
      id: "step-1",
      type: "lifi",
      tool: "0x",
      toolDetails: { key: "0x", name: "0x", logoURI: "" },
      action: {
        fromChainId: 8453,
        toChainId: 8453,
        fromToken: {
          address: "0xusdc",
          symbol: "USDC",
          decimals: 6,
          chainId: 8453,
          name: "USD Coin",
          priceUSD: "1",
        },
        toToken: {
          address: "0xeth",
          symbol: "ETH",
          decimals: 18,
          chainId: 8453,
          name: "Ether",
          priceUSD: "3000",
        },
        fromAmount: "1000000",
        slippage: 0.005,
      },
      estimate: {
        tool: "0x",
        fromAmount: "1000000",
        toAmount: "300000000000000",
        toAmountMin: "297000000000000",
        approvalAddress: "0xrouter",
        executionDuration: 30,
        feeCosts: [],
        gasCosts: [],
      },
      includedSteps: [],
      transactionRequest: {
        to: "0xrouter",
        data: "0xdead",
        value: "0",
        chainId: 8453,
      },
    } as never);

    const q = await quoteLifiTransfer({
      fromChainId: 8453,
      toChainId: 8453,
      fromToken: "0xusdc",
      toToken: "0xeth",
      fromAmount: "1000000",
      fromAddress: "0xtaker",
    });

    expect(q.adapterId).toBe("lifi");
    expect(q.minBuyAmount).toBe("297000000000000");
    expect(q.unsignedTx?.to).toBe("0xrouter");
    expect(q.isCrossChain).toBe(false);
    expect(q.slippage).toBe(0.005);
    expect(q.displayRoute).toContain("USDC");
    expect(q.displayRoute).toContain("LI.FI");
    expect(q.toolName).toBe("LI.FI");
    expect(q.tool).toBe("0x");
  });

  it("preserves legacy gasPrice from LI.FI (HyperEVM-style)", async () => {
    vi.mocked(getQuote).mockResolvedValue({
      id: "step-hype",
      type: "lifi",
      tool: "relaydepository",
      toolDetails: { key: "relaydepository", name: "Relay", logoURI: "" },
      action: {
        fromChainId: 999,
        toChainId: 8453,
        fromToken: {
          address: "0x0000000000000000000000000000000000000000",
          symbol: "HYPE",
          decimals: 18,
          chainId: 999,
          name: "HYPE",
          priceUSD: "50",
        },
        toToken: {
          address: "0x0000000000000000000000000000000000000000",
          symbol: "ETH",
          decimals: 18,
          chainId: 8453,
          name: "ETH",
          priceUSD: "3000",
        },
        fromAmount: "100000000000000000",
        slippage: 0.005,
      },
      estimate: {
        tool: "relaydepository",
        fromAmount: "100000000000000000",
        toAmount: "1000000000000000",
        toAmountMin: "990000000000000",
        approvalAddress: "0xrouter",
        executionDuration: 60,
        feeCosts: [],
        gasCosts: [],
      },
      includedSteps: [],
      transactionRequest: {
        to: "0xrelay",
        data: "0xdead",
        value: "0x5af3107a4000",
        chainId: 999,
        gasPrice: "0xe41e700",
        gasLimit: "0x83658",
      },
    } as never);

    const q = await quoteLifiTransfer({
      fromChainId: 999,
      toChainId: 8453,
      fromToken: "HYPE",
      toToken: "ETH",
      fromAmount: "100000000000000000",
      fromAddress: "0xtaker",
    });

    expect(q.isCrossChain).toBe(true);
    expect(q.fromToken).toBe("0x0000000000000000000000000000000000000000");
    expect(q.toToken).toBe("0x0000000000000000000000000000000000000000");
    expect(q.displayRoute).toContain("999");
    expect(q.displayRoute).toContain("8453");
    expect(q.slippage).toBeGreaterThanOrEqual(0.03);
    expect(q.unsignedTx?.gasPrice).toBe("0xe41e700");
    expect(q.unsignedTx?.gasLimit).toBe("0x83658");
  });

  it("rejects buyToken=ETH on HyperEVM (ambiguous Base gas)", async () => {
    await expect(
      quoteLifiTransfer({
        fromChainId: 999,
        toChainId: 999,
        fromToken: "HYPE",
        toToken: "ETH",
        fromAmount: "100000000000000000",
        fromAddress: "0xtaker",
      }),
    ).rejects.toThrow(/ambiguous_eth_on_hyperevm|noop_same_asset/);
  });

  it("rejects same-chain native→native noop", async () => {
    await expect(
      quoteLifiTransfer({
        fromChainId: 999,
        toChainId: 999,
        fromToken: "HYPE",
        toToken: "HYPE",
        fromAmount: "100000000000000000",
        fromAddress: "0xtaker",
      }),
    ).rejects.toThrow(/noop_same_asset/);
  });

  it("maps Solana quotes that only have transactionRequest.data", async () => {
    const solanaChain = 1151111081099710;
    const b64 = "AQIDBAUGBwg=";
    vi.mocked(getQuote).mockResolvedValue({
      id: "step-sol",
      type: "lifi",
      tool: "jupiter",
      toolDetails: { key: "jupiter", name: "Jupiter", logoURI: "" },
      action: {
        fromChainId: solanaChain,
        toChainId: solanaChain,
        fromToken: {
          address: "So11111111111111111111111111111111111111112",
          symbol: "SOL",
          decimals: 9,
          chainId: solanaChain,
          name: "Solana",
          priceUSD: "100",
        },
        toToken: {
          address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          symbol: "USDC",
          decimals: 6,
          chainId: solanaChain,
          name: "USD Coin",
          priceUSD: "1",
        },
        fromAmount: "1000000000",
        slippage: 0.005,
      },
      estimate: {
        tool: "jupiter",
        fromAmount: "1000000000",
        toAmount: "150000000",
        toAmountMin: "148500000",
        approvalAddress: "",
        executionDuration: 5,
        feeCosts: [],
        gasCosts: [],
      },
      includedSteps: [],
      transactionRequest: {
        data: b64,
        chainId: solanaChain,
      },
    } as never);

    const q = await quoteLifiTransfer({
      fromChainId: solanaChain,
      toChainId: solanaChain,
      fromToken: "SOL",
      toToken: "USDC",
      fromAmount: "1000000000",
      fromAddress: "So11111111111111111111111111111111111111112",
    });

    expect(q.unsignedTx?.data).toBe(b64);
    expect(q.unsignedTx?.to).toBe("");
    expect(q.unsignedTx?.chainId).toBe(solanaChain);
    expect(q.toolName).toBe("LI.FI");
    expect(q.tool).toBe("jupiter");
    expect(q.displayRoute).toContain("LI.FI");
  });
});
