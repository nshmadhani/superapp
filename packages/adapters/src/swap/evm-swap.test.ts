import { describe, it, expect, vi, afterEach } from "vitest";
import { quoteEvmSwap } from "./evm-swap";

describe("quoteEvmSwap", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps 0x quote", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          transaction: {
            to: "0xexchange",
            data: "0xdead",
            value: "0",
          },
          minBuyAmount: "100",
        }),
      }),
    );
    const q = await quoteEvmSwap(
      {
        chainId: 8453,
        sellToken: "0xusdc",
        buyToken: "0xeth",
        sellAmount: "1000000",
        taker: "0xtaker",
      },
      "key",
    );
    expect(q.adapterId).toBe("evm-swap");
    expect(q.to).toBe("0xexchange");
    expect(q.minBuyAmount).toBe("100");
  });
});
