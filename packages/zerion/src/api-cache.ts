import type { PortfolioView } from "./view";

const USER_CACHE_TTL_MS = 30_000;

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
  ttlMs = USER_CACHE_TTL_MS,
): Promise<PortfolioView> {
  const hit = userCache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.view;
  }
  const pending = userInflight.get(key);
  if (pending) return pending;

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

export function clearPortfolioApiCache(): void {
  userCache.clear();
  userInflight.clear();
}
