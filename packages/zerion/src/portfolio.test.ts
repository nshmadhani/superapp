import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  clearPortfolioCache,
  fetchAggregatedPortfolio,
  fetchPortfolio,
} from "./portfolio";
import { resetZerionRateLimitForTests } from "./rate-limit";

function mockOk(symbol = "ETH", value = 3000) {
  return {
    ok: true,
    json: async () => ({
      data: [
        {
          attributes: {
            quantity: { float: 1.5 },
            value,
            fungible_info: {
              symbol,
              name: symbol,
              implementations: [{ chain_id: "base", address: null }],
            },
          },
        },
      ],
    }),
  };
}

describe("fetchPortfolio", () => {
  beforeEach(() => {
    clearPortfolioCache();
    resetZerionRateLimitForTests();
    vi.stubEnv("ZERION_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    clearPortfolioCache();
    resetZerionRateLimitForTests();
  });

  it("maps zerion payload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockOk()));
    const snap = await fetchPortfolio("0xabc", "test-key");
    expect(snap.positions[0]?.symbol).toBe("ETH");
    expect(snap.totalValueUsd).toBe(3000);
    const calledUrl = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(calledUrl).toContain("filter%5Bpositions%5D=no_filter");
  });

  it("maps DeFi / Morpho complex positions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              attributes: {
                name: "Gauntlet USDC Prime",
                protocol: "Morpho",
                protocol_module: "deposit",
                position_type: "deposit",
                quantity: { float: 49.4 },
                value: 49.4,
                fungible_info: {
                  symbol: "USDC",
                  name: "USD Coin",
                  implementations: [
                    { chain_id: "base", address: "0x8335" },
                  ],
                },
              },
              relationships: { chain: { data: { id: "base" } } },
            },
          ],
        }),
      }),
    );
    const snap = await fetchPortfolio("0xabc", "test-key");
    expect(snap.positions[0]?.kind).toBe("defi");
    expect(snap.positions[0]?.protocol).toBe("Morpho");
    expect(snap.positions[0]?.symbol).toBe("USDC");
    expect(snap.positions[0]?.name).toContain("Morpho");
  });

  it("serves cache on second call without another HTTP", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockOk());
    vi.stubGlobal("fetch", fetchMock);
    await fetchPortfolio("0xAbC", "test-key");
    await fetchPortfolio("0xabc", "test-key");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("dedupes in-flight requests for the same address", async () => {
    let resolveFetch!: (v: unknown) => void;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const a = fetchPortfolio("0xdedupe", "test-key");
    const b = fetchPortfolio("0xDedupe", "test-key");
    // Flush rate-limit queue so the single HTTP starts
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch!(mockOk("SOL", 100));
    const [sa, sb] = await Promise.all([a, b]);
    expect(sa.totalValueUsd).toBe(100);
    expect(sb.totalValueUsd).toBe(100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches each distinct wallet once when aggregating", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockOk());
    vi.stubGlobal("fetch", fetchMock);

    const agg = await fetchAggregatedPortfolio([
      {
        id: "1",
        address: "0xaaa",
        chainFamily: "evm",
        source: "turnkey",
      },
      {
        id: "2",
        address: "0xbbb",
        chainFamily: "evm",
        source: "turnkey",
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(agg.wallets).toHaveLength(2);
  });
});
