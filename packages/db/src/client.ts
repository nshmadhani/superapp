import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createDb(env: NodeJS.ProcessEnv = process.env): SupabaseClient {
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase URL or service role key");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
