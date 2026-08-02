import {
  deletePortfolioCache,
  getPortfolioCache,
  portfolioCacheAvailable,
  upsertPortfolioCache,
} from "@ervo/db";
import type { PortfolioView } from "./view";

/** Shared TTL for durable (Supabase) + in-memory fallback. */
export const PORTFOLIO_VIEW_CACHE_TTL_MS = 20 * 60 * 1000;

type MemoryEntry = {
  expiresAt: number;
  view: PortfolioView;
};

/** Fallback when Supabase env is missing (local / unit tests). */
const memoryCache = new Map<string, MemoryEntry>();
/** Same-isolate stampede control only — not a TTL cache. */
const inflight = new Map<string, Promise<PortfolioView>>();

function normalizeAddress(address: string): string {
  return address.startsWith("0x") ? address.toLowerCase() : address;
}

/** Address-first key — shareable across users / future public API. */
export function portfolioAddressCacheKey(address: string): string {
  return `address:${normalizeAddress(address)}`;
}

export function portfolioUserAllCacheKey(userId: string): string {
  return `user:${userId}:all`;
}

/**
 * Cache key for dashboard/agent callers.
 * - scope `all` → `user:<userId>:all`
 * - otherwise → `address:<normalized>` (userId ignored; ownership checked upstream)
 */
export function portfolioApiCacheKey(
  userId: string,
  scope: "all" | string,
): string {
  if (scope === "all") return portfolioUserAllCacheKey(userId);
  return portfolioAddressCacheKey(scope);
}

function parseAddressFromKey(key: string): string | null {
  if (!key.startsWith("address:")) return null;
  return key.slice("address:".length) || null;
}

function parseUserIdFromKey(key: string): string | null {
  const m = /^user:([^:]+):all$/.exec(key);
  return m?.[1] ?? null;
}

async function durableGet(key: string): Promise<PortfolioView | null> {
  if (!portfolioCacheAvailable()) {
    const hit = memoryCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.view;
    return null;
  }
  try {
    const row = await getPortfolioCache(key);
    if (!row?.view || typeof row.view !== "object") return null;
    return row.view as PortfolioView;
  } catch (err) {
    console.error("portfolio_cache get failed; treating as miss", err);
    return null;
  }
}

async function durableSet(
  key: string,
  view: PortfolioView,
  ttlMs: number,
  meta?: { userId?: string | null; address?: string | null },
): Promise<void> {
  if (!portfolioCacheAvailable()) {
    memoryCache.set(key, { view, expiresAt: Date.now() + ttlMs });
    return;
  }
  try {
    await upsertPortfolioCache({
      cacheKey: key,
      userId: meta?.userId ?? parseUserIdFromKey(key),
      address: meta?.address ?? parseAddressFromKey(key),
      view,
      ttlMs,
    });
  } catch (err) {
    console.error("portfolio_cache upsert failed", err);
  }
}

async function durableDelete(key: string): Promise<void> {
  memoryCache.delete(key);
  if (!portfolioCacheAvailable()) return;
  try {
    await deletePortfolioCache(key);
  } catch (err) {
    console.error("portfolio_cache delete failed", err);
  }
}

export async function cachedPortfolioView(
  key: string,
  load: () => Promise<PortfolioView>,
  opts?: {
    ttlMs?: number;
    force?: boolean;
    userId?: string | null;
    address?: string | null;
  },
): Promise<PortfolioView> {
  const ttlMs = opts?.ttlMs ?? PORTFOLIO_VIEW_CACHE_TTL_MS;
  const force = opts?.force === true;

  if (force) {
    await durableDelete(key);
    const pending = inflight.get(key);
    if (pending) {
      try {
        await pending;
      } catch {
        /* ignore prior failure */
      }
    }
  } else {
    const pending = inflight.get(key);
    if (pending) return pending;
  }

  // Register inflight before any await so concurrent callers coalesce.
  const existing = inflight.get(key);
  if (existing && !force) return existing;

  const job = (async () => {
    if (!force) {
      const hit = await durableGet(key);
      if (hit) return hit;
    }
    const view = await load();
    await durableSet(key, view, ttlMs, {
      userId: opts?.userId,
      address: opts?.address,
    });
    return view;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, job);
  return job;
}

export function clearPortfolioApiCache(key?: string): void {
  if (key) {
    memoryCache.delete(key);
    inflight.delete(key);
    return;
  }
  memoryCache.clear();
  inflight.clear();
}
