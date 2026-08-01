import type { PortfolioView } from "./view";

/** In-process portfolio view TTL. TODO: move to Supabase (shared durable cache). */
export const PORTFOLIO_VIEW_CACHE_TTL_MS = 20 * 60 * 1000;

type CacheEntry = {
  expiresAt: number;
  view: PortfolioView;
};

const userCache = new Map<string, CacheEntry>();
const userInflight = new Map<string, Promise<PortfolioView>>();

export function portfolioApiCacheKey(
  userId: string,
  scope: "all" | string,
): string {
  if (scope === "all") return `${userId}:all`;
  const normalized = scope.startsWith("0x") ? scope.toLowerCase() : scope;
  return `${userId}:wallet:${normalized}`;
}

export async function cachedPortfolioView(
  key: string,
  load: () => Promise<PortfolioView>,
  opts?: { ttlMs?: number; force?: boolean },
): Promise<PortfolioView> {
  const ttlMs = opts?.ttlMs ?? PORTFOLIO_VIEW_CACHE_TTL_MS;
  const force = opts?.force === true;

  if (force) {
    userCache.delete(key);
    const pending = userInflight.get(key);
    if (pending) {
      try {
        await pending;
      } catch {
        /* ignore prior failure */
      }
    }
  } else {
    const hit = userCache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.view;
    }
    const pending = userInflight.get(key);
    if (pending) return pending;
  }

  const existing = userInflight.get(key);
  if (existing) return existing;

  const job = load()
    .then((view) => {
      userCache.set(key, { view, expiresAt: Date.now() + ttlMs });
      return view;
    })
    .finally(() => {
      userInflight.delete(key);
    });
  userInflight.set(key, job);
  return job;
}

export function clearPortfolioApiCache(key?: string): void {
  if (key) {
    userCache.delete(key);
    return;
  }
  userCache.clear();
  userInflight.clear();
}
