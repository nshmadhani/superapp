import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchUsdcYields } from "./yields";

describe("fetchUsdcYields", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("filters USDC pools by TVL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              pool: "a",
              project: "aave-v3",
              chain: "Base",
              symbol: "USDC",
              tvlUsd: 5_000_000,
              apy: 3.2,
            },
            {
              pool: "b",
              project: "tiny",
              chain: "Base",
              symbol: "USDC",
              tvlUsd: 100,
              apy: 90,
            },
          ],
        }),
      }),
    );
    const pools = await fetchUsdcYields(5);
    expect(pools).toHaveLength(1);
    expect(pools[0]?.project).toBe("aave-v3");
  });
});
