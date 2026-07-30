import type { SupabaseClient } from "@ervo/db";
import {
  agentRunStore,
  kickAgentRun,
  type AgentRun,
} from "@ervo/agent-jobs";
import { upsertAgentRun, type PersistedAgentRun } from "@ervo/db";
import { ensureAgentRuntime, toPersisted } from "./register-runtime";

type WalletOrphan = {
  agentRunId: string;
  address: string;
  label?: string;
  createdAt: string;
};

/**
 * If an ephemeral wallet exists without an agent_runs row (lost on restart),
 * recreate a live DCA run so Stop/Destroy and the Agents list work again.
 */
export async function backfillOrphanAgentRuns(
  db: SupabaseClient,
  userId: string,
): Promise<AgentRun[]> {
  ensureAgentRuntime();

  const { data, error } = await db
    .from("agent_wallets")
    .select("agent_run_id, address, label, created_at, status")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw error;

  const orphans: WalletOrphan[] = (data ?? []).map(
    (row: {
      agent_run_id: string;
      address: string;
      label: string | null;
      created_at: string;
    }) => ({
      agentRunId: String(row.agent_run_id),
      address: String(row.address),
      label: row.label ?? undefined,
      createdAt: String(row.created_at),
    }),
  );

  const created: AgentRun[] = [];
  for (const orphan of orphans) {
    if (agentRunStore.get(orphan.agentRunId)) continue;

    const { data: existing } = await db
      .from("agent_runs")
      .select("id")
      .eq("id", orphan.agentRunId)
      .maybeSingle();
    if (existing) continue;

    const goal =
      "Buy $1 of HYPE every 10 seconds on HyperEVM until USDC is spent";
    const policy = {
      preset: "dca",
      live: true,
      asset: "HYPE",
      buyToken: "HYPE",
      sellToken: "USDC",
      amountUsd: 1,
      chainId: 999,
      intervalSeconds: 10,
      backfilled: true,
    };

    const run = agentRunStore.create({
      id: orphan.agentRunId,
      userId,
      type: "dca",
      goal,
      policy,
      wallet: {
        address: orphan.address,
        chainFamily: "evm",
        label: orphan.label ?? "Agent wallet",
        source: "ephemeral",
      },
    });

    const patched = agentRunStore.get(run.id)!;
    const persisted: PersistedAgentRun = {
      ...toPersisted(patched),
      createdAt: orphan.createdAt || patched.createdAt,
    };
    await upsertAgentRun(db, persisted);
    created.push(patched);
    kickAgentRun(patched.id);
  }

  return created;
}
