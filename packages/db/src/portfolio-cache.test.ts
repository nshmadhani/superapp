import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPortfolioCache,
  upsertPortfolioCache,
  deletePortfolioCache,
  deletePortfolioCacheByAddress,
} from "./portfolio-cache";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockDb(handlers: {
  selectResult?: { data: unknown; error: null | { message: string } };
  upsertError?: { message: string } | null;
  deleteError?: { message: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(
    handlers.selectResult ?? { data: null, error: null },
  );
  const gt = vi.fn(() => ({ maybeSingle }));
  const eqSelect = vi.fn(() => ({ gt }));
  const select = vi.fn(() => ({ eq: eqSelect }));

  const upsert = vi.fn().mockResolvedValue({
    error: handlers.upsertError ?? null,
  });

  const eqDelete = vi.fn().mockResolvedValue({
    error: handlers.deleteError ?? null,
  });
  const deleteFn = vi.fn(() => ({ eq: eqDelete }));

  const from = vi.fn(() => ({
    select,
    upsert,
    delete: deleteFn,
  }));

  return {
    db: { from } as unknown as SupabaseClient,
    from,
    select,
    eqSelect,
    gt,
    maybeSingle,
    upsert,
    deleteFn,
    eqDelete,
  };
}

describe("portfolio-cache helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getPortfolioCache returns mapped row when unexpired", async () => {
    const { db, eqSelect, gt } = mockDb({
      selectResult: {
        data: {
          cache_key: "address:0xabc",
          user_id: null,
          address: "0xabc",
          view_json: { totalValueUsd: 1 },
          fetched_at: "2026-08-01T00:00:00.000Z",
          expires_at: "2099-01-01T00:00:00.000Z",
        },
        error: null,
      },
    });
    const row = await getPortfolioCache("address:0xabc", db);
    expect(row?.cacheKey).toBe("address:0xabc");
    expect(row?.view).toEqual({ totalValueUsd: 1 });
    expect(eqSelect).toHaveBeenCalledWith("cache_key", "address:0xabc");
    expect(gt).toHaveBeenCalled();
  });

  it("getPortfolioCache returns null on miss", async () => {
    const { db } = mockDb({ selectResult: { data: null, error: null } });
    expect(await getPortfolioCache("missing", db)).toBeNull();
  });

  it("upsertPortfolioCache writes ttl expiry", async () => {
    const { db, upsert } = mockDb({});
    await upsertPortfolioCache(
      {
        cacheKey: "user:u1:all",
        userId: "u1",
        view: { totalValueUsd: 0 },
        ttlMs: 60_000,
      },
      db,
    );
    expect(upsert).toHaveBeenCalledTimes(1);
    const payload = upsert.mock.calls[0]?.[0] as {
      cache_key: string;
      user_id: string;
      expires_at: string;
    };
    expect(payload.cache_key).toBe("user:u1:all");
    expect(payload.user_id).toBe("u1");
    expect(new Date(payload.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("deletePortfolioCacheByAddress normalizes evm address", async () => {
    const { db, eqDelete } = mockDb({});
    await deletePortfolioCacheByAddress("0xABC", db);
    expect(eqDelete).toHaveBeenCalledWith("address", "0xabc");
  });

  it("deletePortfolioCache deletes by key", async () => {
    const { db, eqDelete } = mockDb({});
    await deletePortfolioCache("user:u1:all", db);
    expect(eqDelete).toHaveBeenCalledWith("cache_key", "user:u1:all");
  });
});
