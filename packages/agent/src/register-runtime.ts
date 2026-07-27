import type { SupabaseClient } from "@cipher/db";
import {
  agentRunStore,
  kickAgentRun,
  reconcileAgentRun,
  setAgentRunPersister,
  setLiveAgentExecutor,
  shouldResumeAgentRun,
  type AgentRun,
  type AgentStep,
} from "@cipher/agent-jobs";
import {
  createDb,
  getAgentRun,
  listAgentRuns,
  upsertAgentRun,
  type PersistedAgentRun,
} from "@cipher/db";
import { executeLiveDca } from "./live-dca";

let registered = false;

function toPersisted(run: AgentRun): PersistedAgentRun {
  return {
    id: run.id,
    userId: run.userId,
    type: String(run.type || "general"),
    goal: run.goal,
    policy: run.policy ?? {},
    status: run.status,
    steps: run.steps,
    artifact: run.artifact,
    source: run.source,
    wallet: run.wallet
      ? {
          address: run.wallet.address,
          chainFamily: run.wallet.chainFamily,
          label: run.wallet.label,
          source: "ephemeral",
        }
      : null,
    sandboxId: run.sandboxId,
    error: run.error,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    finishedAt: run.finishedAt,
  };
}

function fromPersisted(row: PersistedAgentRun): AgentRun {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    goal: row.goal,
    policy: row.policy ?? {},
    status: row.status as AgentRun["status"],
    steps: (row.steps as AgentStep[]) ?? [],
    artifact: (row.artifact as AgentRun["artifact"]) ?? null,
    source: row.source,
    wallet: row.wallet
      ? {
          address: row.wallet.address,
          chainFamily: row.wallet.chainFamily,
          label: row.wallet.label,
          source: "ephemeral",
        }
      : null,
    sandboxId: row.sandboxId,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    finishedAt: row.finishedAt,
  };
}

async function persist(run: AgentRun): Promise<void> {
  const db = createDb();
  await upsertAgentRun(db, toPersisted(run));
}

/**
 * Wire DB persistence + live DCA executor once per process.
 * Safe to call from any API / tool entrypoint.
 */
export function ensureAgentRuntime(): void {
  if (registered) return;
  registered = true;
  setAgentRunPersister((run) => {
    void persist(run);
  });
  setLiveAgentExecutor((runId) => executeLiveDca(runId));
}

export async function hydrateAgentRun(
  db: SupabaseClient,
  userId: string,
  runId: string,
): Promise<AgentRun | null> {
  ensureAgentRuntime();
  const mem = agentRunStore.get(runId);
  if (mem && mem.userId === userId) return mem;

  const row = await getAgentRun(db, userId, runId);
  if (!row) return null;
  return agentRunStore.hydrate(fromPersisted(row));
}

export async function listHydratedAgentRuns(
  db: SupabaseClient,
  userId: string,
): Promise<AgentRun[]> {
  ensureAgentRuntime();
  const rows = await listAgentRuns(db, userId);
  const out: AgentRun[] = [];
  for (const row of rows) {
    const existing = agentRunStore.get(row.id);
    const run =
      existing && existing.userId === userId
        ? existing
        : agentRunStore.hydrate(fromPersisted(row));
    out.push(reconcileAgentRun(run.id) ?? run);
  }
  return out;
}

/** Resume at most one open run (oldest), so agents never fan out in parallel. */
export function resumeOpenAgentRuns(runs: AgentRun[]): void {
  ensureAgentRuntime();
  const candidates = runs
    .filter((r) => shouldResumeAgentRun(r))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const running = candidates.find((r) => r.status === "running");
  const next = running ?? candidates[0];
  if (next) kickAgentRun(next.id);
}

export { fromPersisted, toPersisted };
