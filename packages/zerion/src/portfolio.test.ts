import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchPortfolio } from "./portfolio";

describe("fetchPortfolio", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps zerion payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              attributes: {
                quantity: { float: 1.5 },
                value: 3000,
                fungible_info: {
                  symbol: "ETH",
                  name: "Ether",
                  implementations: [{ chain_id: "base", address: null }],
                },
              },
            },
          ],
        }),
      }),
    );
    const snap = await fetchPortfolio("0xabc", "test-key");
    expect(snap.positions[0]?.symbol).toBe("ETH");
    expect(snap.totalValueUsd).toBe(3000);
  });
});
