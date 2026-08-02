import type { SupabaseClient } from "@supabase/supabase-js";
import { createDb, hasSupabaseEnv } from "./client";

export type PortfolioCacheRow = {
  cacheKey: string;
  userId: string | null;
  address: string | null;
  view: unknown;
  fetchedAt: string;
  expiresAt: string;
};

function mapRow(row: Record<string, unknown>): PortfolioCacheRow {
  return {
    cacheKey: String(row.cache_key),
    userId: (row.user_id as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    view: row.view_json,
    fetchedAt: String(row.fetched_at),
    expiresAt: String(row.expires_at),
  };
}

/** Return cached view JSON if present and not expired. */
export async function getPortfolioCache(
  cacheKey: string,
  db: SupabaseClient = createDb(),
): Promise<PortfolioCacheRow | null> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("portfolio_cache")
    .select("*")
    .eq("cache_key", cacheKey)
    .gt("expires_at", now)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function upsertPortfolioCache(
  opts: {
    cacheKey: string;
    userId?: string | null;
    address?: string | null;
    view: unknown;
    ttlMs: number;
  },
  db: SupabaseClient = createDb(),
): Promise<void> {
  const fetchedAt = new Date();
  const expiresAt = new Date(fetchedAt.getTime() + opts.ttlMs);
  const { error } = await db.from("portfolio_cache").upsert(
    {
      cache_key: opts.cacheKey,
      user_id: opts.userId ?? null,
      address: opts.address ?? null,
      view_json: opts.view,
      fetched_at: fetchedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: "cache_key" },
  );
  if (error) throw error;
}

export async function deletePortfolioCache(
  cacheKey: string,
  db: SupabaseClient = createDb(),
): Promise<void> {
  const { error } = await db
    .from("portfolio_cache")
    .delete()
    .eq("cache_key", cacheKey);
  if (error) throw error;
}

export async function deletePortfolioCacheByAddress(
  address: string,
  db: SupabaseClient = createDb(),
): Promise<void> {
  const normalized = address.startsWith("0x")
    ? address.toLowerCase()
    : address;
  const { error } = await db
    .from("portfolio_cache")
    .delete()
    .eq("address", normalized);
  if (error) throw error;
}

/** Convenience: no-op helpers when Supabase env is missing (local/tests). */
export function portfolioCacheAvailable(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return hasSupabaseEnv(env);
}
