import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  cachedPortfolioView,
  clearPortfolioApiCache,
  portfolioApiCacheKey,
  portfolioAddressCacheKey,
  portfolioUserAllCacheKey,
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
        { id: "hyperliquid", status: "empty", valueUsd: 0 },
        { id: "polymarket", status: "empty", valueUsd: 0 },
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
    vi.unstubAllEnvs();
    // Force memory fallback (no Supabase in unit tests).
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  });

  it("builds address-first and user:all keys", () => {
    expect(portfolioApiCacheKey("u1", "all")).toBe("user:u1:all");
    expect(portfolioApiCacheKey("u1", "0xABC")).toBe("address:0xabc");
    expect(portfolioAddressCacheKey("0xABC")).toBe("address:0xabc");
    expect(portfolioUserAllCacheKey("u1")).toBe("user:u1:all");
  });

  it("serves cached view within TTL without reloading", async () => {
    const load = vi
      .fn()
      .mockResolvedValue(emptyView("2026-01-01T00:00:00.000Z"));
    const key = portfolioApiCacheKey("user", "all");
    const a = await cachedPortfolioView(key, load, { userId: "user" });
    const b = await cachedPortfolioView(key, load, { userId: "user" });
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
    // Let durable miss complete so load is invoked once for both waiters.
    await vi.waitFor(() => {
      expect(load).toHaveBeenCalledTimes(1);
    });
    resolve!(emptyView("t1"));
    const [a, b] = await Promise.all([p1, p2]);
    expect(a.asOf).toBe("t1");
    expect(b.asOf).toBe("t1");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("force bypasses cached view", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(emptyView("cached"))
      .mockResolvedValueOnce(emptyView("fresh"));
    const key = portfolioApiCacheKey("user", "all");
    await cachedPortfolioView(key, load);
    const forced = await cachedPortfolioView(key, load, { force: true });
    expect(load).toHaveBeenCalledTimes(2);
    expect(forced.asOf).toBe("fresh");
  });
});
