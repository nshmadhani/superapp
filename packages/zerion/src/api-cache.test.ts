import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  cachedPortfolioView,
  clearPortfolioApiCache,
  portfolioApiCacheKey,
} from "./api-cache";
import type { PortfolioView } from "./view";

function emptyView(asOf: string): PortfolioView {
  return {
    totalValueUsd: 0,
    tokensValueUsd: 0,
    defiValueUsd: 0,
    positionsValueUsd: 0,
    asOf,
    tokens: [],
    positions: {
      venues: [
        { id: "hyperliquid", status: "coming_soon" },
        { id: "polymarket", status: "coming_soon" },
      ],
      positions: [],
      valueUsd: 0,
    },
    defi: [],
    wallets: [],
  };
}

describe("portfolioApiCache", () => {
  beforeEach(() => {
    clearPortfolioApiCache();
  });

  it("builds stable cache keys", () => {
    expect(portfolioApiCacheKey("u1", "all")).toBe("u1:all");
    expect(portfolioApiCacheKey("u1", "0xABC")).toBe("u1:wallet:0xabc");
  });

  it("serves cached view within TTL without reloading", async () => {
    const load = vi
      .fn()
      .mockResolvedValue(emptyView("2026-01-01T00:00:00.000Z"));
    const key = portfolioApiCacheKey("user", "all");
    const a = await cachedPortfolioView(key, load);
    const b = await cachedPortfolioView(key, load);
    expect(load).toHaveBeenCalledTimes(1);
    expect(a.asOf).toBe(b.asOf);
  });

  it("dedupes in-flight loads", async () => {
    let resolve!: (v: PortfolioView) => void;
    const load = vi.fn(
      () =>
        new Promise<PortfolioView>((r) => {
          resolve = r;
        }),
    );
    const key = portfolioApiCacheKey("user", "all");
    const p1 = cachedPortfolioView(key, load);
    const p2 = cachedPortfolioView(key, load);
    expect(load).toHaveBeenCalledTimes(1);
    resolve!(emptyView("t1"));
    const [a, b] = await Promise.all([p1, p2]);
    expect(a.asOf).toBe("t1");
    expect(b.asOf).toBe("t1");
  });
});
