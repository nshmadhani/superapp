import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client for server mutations (wallets, plans, auth.admin).
 * Browser / cookie-session clients live in apps/web/lib/supabase (publishable key).
 */
export function createDb(env: NodeJS.ProcessEnv = process.env): SupabaseClient {
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY (server-only)",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export function hasSupabaseEnv(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(
    (env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL) &&
      env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
