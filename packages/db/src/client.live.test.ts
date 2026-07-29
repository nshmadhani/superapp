import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createDb, hasSupabaseEnv } from "./client";

/** Load apps/web/.env.local into process.env when present (dev/test shared hosted DB). */
function loadWebEnvLocal() {
  const path = resolve(process.cwd(), "../../apps/web/.env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadWebEnvLocal();

const live = hasSupabaseEnv();

describe.runIf(live)("createDb (hosted Supabase)", () => {
  it("connects and can query public.users", async () => {
    const db = createDb();
    const { error, count } = await db
      .from("users")
      .select("*", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(typeof count === "number" || count === null).toBe(true);
  });
});

describe.runIf(!live)("createDb (skipped — no service role)", () => {
  it("documents required env for live tests", () => {
    expect(hasSupabaseEnv()).toBe(false);
  });
});
