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

const EVM_ADDR = "0x1111111111111111111111111111111111111111";
const EVM_ADDR_B = "0x2222222222222222222222222222222222222222";
const SOL_ADDR = "So11111111111111111111111111111111111111112";

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
    const snap = await fetchPortfolio(EVM_ADDR, "test-key");
    expect(snap.positions[0]?.symbol).toBe("ETH");
    expect(snap.totalValueUsd).toBe(3000);
    const calledUrl = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(calledUrl).toContain("filter%5Bpositions%5D=no_filter");
  });

  it("maps fungible icon URL when present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              attributes: {
                quantity: { float: 1 },
                value: 10,
                fungible_info: {
                  symbol: "USDC",
                  name: "USD Coin",
                  icon: { url: "https://cdn.zerion.io/usdc.png" },
                  implementations: [{ chain_id: "base", address: "0x8335" }],
                },
              },
            },
          ],
        }),
      }),
    );
    const snap = await fetchPortfolio(EVM_ADDR, "test-key");
    expect(snap.positions[0]?.iconUrl).toBe("https://cdn.zerion.io/usdc.png");
  });

  it("omits no_filter for Solana addresses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockOk("SOL", 150)),
    );
    const snap = await fetchPortfolio(SOL_ADDR, "test-key");
    expect(snap.chainFamily).toBe("solana");
    expect(snap.positions[0]?.symbol).toBe("SOL");
    const calledUrl = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(calledUrl).not.toContain("filter%5Bpositions%5D=no_filter");
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
    const snap = await fetchPortfolio(EVM_ADDR, "test-key");
    expect(snap.positions[0]?.kind).toBe("defi");
    expect(snap.positions[0]?.protocol).toBe("Morpho");
    expect(snap.positions[0]?.symbol).toBe("USDC");
    expect(snap.positions[0]?.name).toContain("Morpho");
  });

  it("serves cache on second call without another HTTP", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockOk());
    vi.stubGlobal("fetch", fetchMock);
    await fetchPortfolio(EVM_ADDR, "test-key");
    await fetchPortfolio(EVM_ADDR.toUpperCase().replace("0X", "0x"), "test-key");
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

    const a = fetchPortfolio(EVM_ADDR, "test-key");
    const b = fetchPortfolio(EVM_ADDR.toLowerCase(), "test-key");
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
        address: EVM_ADDR,
        chainFamily: "evm",
        source: "turnkey",
      },
      {
        id: "2",
        address: EVM_ADDR_B,
        chainFamily: "evm",
        source: "turnkey",
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(agg.wallets).toHaveLength(2);
    expect(agg.tokens.length).toBeGreaterThan(0);
    expect(agg.positions.venues).toHaveLength(2);
    expect(agg.defi).toEqual([]);
  });
});
