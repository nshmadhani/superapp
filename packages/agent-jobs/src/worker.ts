import { agentRunStore } from "./store";
import { runDcaJob } from "./runners/dca";
import { runTaJob } from "./runners/ta";
import { runDaoJob } from "./runners/dao";
import type { AgentRun } from "./types";

const inflight = new Set<string>();

export function kickAgentRun(runId: string): void {
  if (inflight.has(runId)) return;
  inflight.add(runId);
  void executeAgentRun(runId).finally(() => inflight.delete(runId));
}

export async function executeAgentRun(runId: string): Promise<AgentRun | null> {
  const run = agentRunStore.get(runId);
  if (!run) return null;
  if (run.status === "cancelled" || run.status === "succeeded") return run;

  agentRunStore.update(runId, { status: "running", error: undefined });

  const prepId = crypto.randomUUID();
  agentRunStore.appendStep(runId, {
    id: prepId,
    label: "Prepare autonomous run",
    status: "running",
  });
  agentRunStore.patchStep(runId, prepId, { status: "done" });

  const workId = crypto.randomUUID();
  const workLabel =
    run.type === "dca"
      ? "Build DCA schedule in E2B"
      : run.type === "ta"
        ? "Fetch OHLCV + analyze in E2B"
        : "Research DAO + summarize in E2B";
  agentRunStore.appendStep(runId, {
    id: workId,
    label: workLabel,
    status: "running",
  });

  try {
    const result =
      run.type === "dca"
        ? await runDcaJob(run.goal, run.policy)
        : run.type === "ta"
          ? await runTaJob(run.goal, run.policy)
          : await runDaoJob(run.goal, run.policy);

    agentRunStore.patchStep(runId, workId, {
      status: "done",
      detail: result.source === "fallback" ? "fallback artifact" : "live",
    });

    return agentRunStore.update(runId, {
      status: "succeeded",
      artifact: result.artifact,
      source: result.source,
      sandboxId: result.sandboxId,
      finishedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "agent_run_failed";
    agentRunStore.patchStep(runId, workId, {
      status: "error",
      detail: message,
    });
    return agentRunStore.update(runId, {
      status: "failed",
      error: message,
      finishedAt: new Date().toISOString(),
    });
  }
}
