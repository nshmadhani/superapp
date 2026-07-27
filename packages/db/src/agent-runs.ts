import type { SupabaseClient } from "@supabase/supabase-js";

export type PersistedAgentWallet = {
  address: string;
  chainFamily: "evm" | "solana";
  label: string;
  source: "ephemeral";
};

export type PersistedAgentRun = {
  id: string;
  userId: string;
  type: string;
  goal: string;
  policy: Record<string, unknown>;
  status: string;
  steps: unknown[];
  artifact: unknown | null;
  source: "live" | "fallback" | null;
  wallet: PersistedAgentWallet | null;
  sandboxId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
};

function publicWallet(wallet: unknown): PersistedAgentWallet | null {
  if (!wallet || typeof wallet !== "object") return null;
  const w = wallet as Record<string, unknown>;
  const address = String(w.address ?? "");
  if (!address) return null;
  return {
    address,
    chainFamily: w.chainFamily === "solana" ? "solana" : "evm",
    label: String(w.label ?? "Agent wallet"),
    source: "ephemeral",
  };
}

function mapRow(row: Record<string, unknown>): PersistedAgentRun {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    type: String(row.type ?? "general"),
    goal: String(row.goal ?? ""),
    policy: (row.policy as Record<string, unknown>) ?? {},
    status: String(row.status ?? "queued"),
    steps: Array.isArray(row.steps) ? row.steps : [],
    artifact: row.artifact ?? null,
    source:
      row.source === "live" || row.source === "fallback"
        ? row.source
        : null,
    wallet: publicWallet(row.wallet),
    sandboxId: (row.sandbox_id as string | null) ?? undefined,
    error: (row.error as string | null) ?? undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    finishedAt: (row.finished_at as string | null) ?? undefined,
  };
}

function toRow(run: PersistedAgentRun) {
  return {
    id: run.id,
    user_id: run.userId,
    type: run.type,
    goal: run.goal,
    policy: run.policy ?? {},
    status: run.status,
    steps: run.steps ?? [],
    artifact: run.artifact ?? null,
    source: run.source,
    wallet: publicWallet(run.wallet),
    sandbox_id: run.sandboxId ?? null,
    error: run.error ?? null,
    created_at: run.createdAt,
    updated_at: run.updatedAt,
    finished_at: run.finishedAt ?? null,
  };
}

export async function upsertAgentRun(
  db: SupabaseClient,
  run: PersistedAgentRun,
): Promise<PersistedAgentRun> {
  const { data, error } = await db
    .from("agent_runs")
    .upsert(toRow(run), { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function getAgentRun(
  db: SupabaseClient,
  userId: string,
  runId: string,
): Promise<PersistedAgentRun | null> {
  const { data, error } = await db
    .from("agent_runs")
    .select("*")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function listAgentRuns(
  db: SupabaseClient,
  userId: string,
): Promise<PersistedAgentRun[]> {
  const { data, error } = await db
    .from("agent_runs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

const ACTIVE_STATUSES = ["queued", "running", "needs_confirm"] as const;

/** Open runs that block spawning another agent. */
export async function listActiveAgentRuns(
  db: SupabaseClient,
  userId: string,
): Promise<PersistedAgentRun[]> {
  const { data, error } = await db
    .from("agent_runs")
    .select("*")
    .eq("user_id", userId)
    .in("status", [...ACTIVE_STATUSES])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function patchAgentRun(
  db: SupabaseClient,
  userId: string,
  runId: string,
  patch: Partial<
    Pick<
      PersistedAgentRun,
      | "status"
      | "steps"
      | "artifact"
      | "source"
      | "wallet"
      | "sandboxId"
      | "error"
      | "finishedAt"
    >
  >,
): Promise<PersistedAgentRun | null> {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.steps !== undefined) row.steps = patch.steps;
  if (patch.artifact !== undefined) row.artifact = patch.artifact;
  if (patch.source !== undefined) row.source = patch.source;
  if (patch.wallet !== undefined) row.wallet = publicWallet(patch.wallet);
  if (patch.sandboxId !== undefined) row.sandbox_id = patch.sandboxId;
  if (patch.error !== undefined) row.error = patch.error;
  if (patch.finishedAt !== undefined) row.finished_at = patch.finishedAt;

  const { data, error } = await db
    .from("agent_runs")
    .update(row)
    .eq("id", runId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}
