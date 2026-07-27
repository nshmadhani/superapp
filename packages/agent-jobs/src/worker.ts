import { agentRunStore } from "./store";
import { runDcaJob } from "./runners/dca";
import { runTaJob } from "./runners/ta";
import { runDaoJob } from "./runners/dao";
import { runGeneralJob } from "./runners/general";
import type { AgentArtifact, AgentRun } from "./types";

const inflight = new Set<string>();

export type LiveAgentExecutor = (runId: string) => Promise<AgentRun | null>;

let liveExecutor: LiveAgentExecutor | null = null;

/** Register host-side live executor (funded DCA loop). Keys never enter E2B. */
export function setLiveAgentExecutor(fn: LiveAgentExecutor | null): void {
  liveExecutor = fn;
}

export function kickAgentRun(runId: string): void {
  if (inflight.has(runId)) return;
  inflight.add(runId);
  void executeAgentRun(runId).finally(() => inflight.delete(runId));
}

function presetOf(run: AgentRun): string {
  const fromPolicy = run.policy?.preset;
  if (typeof fromPolicy === "string" && fromPolicy.trim()) return fromPolicy;
  return String(run.type || "general");
}

/** Funded DCA (or policy.live) → long-running host loop after E2B plan. */
export function shouldRunLive(run: AgentRun): boolean {
  if (!run.wallet) return false;
  if (run.policy?.live === true) return true;
  if (typeof run.policy?.intervalSeconds === "number") return true;
  const preset = presetOf(run);
  if (preset === "dca") return true;
  if (/every\s+\d+\s*(s|sec|second|m|min)/i.test(run.goal)) return true;
  return false;
}

export async function executeAgentRun(runId: string): Promise<AgentRun | null> {
  const run = agentRunStore.get(runId);
  if (!run) return null;
  if (run.status === "cancelled" || run.status === "succeeded") return run;

  agentRunStore.update(runId, { status: "running", error: undefined });

  if (run.wallet) {
    const walletStepId = crypto.randomUUID();
    agentRunStore.appendStep(runId, {
      id: walletStepId,
      label: `Agent wallet ${run.wallet.label}`,
      status: "running",
      detail: run.wallet.address,
    });
    agentRunStore.patchStep(runId, walletStepId, {
      status: "done",
      detail: `${run.wallet.address} (${run.wallet.source})`,
    });
  }

  const prepId = crypto.randomUUID();
  agentRunStore.appendStep(runId, {
    id: prepId,
    label: "Prepare autonomous run",
    status: "running",
  });
  agentRunStore.patchStep(runId, prepId, { status: "done" });

  if (shouldRunLive(run) && liveExecutor) {
    return liveExecutor(runId);
  }

  const preset = presetOf(run);
  const workId = crypto.randomUUID();
  const workLabel =
    preset === "dca"
      ? "Build DCA schedule in E2B"
      : preset === "ta"
        ? "Fetch OHLCV + analyze in E2B"
        : preset === "dao_research"
          ? "Research DAO + summarize in E2B"
          : "Run autonomous job in E2B";
  agentRunStore.appendStep(runId, {
    id: workId,
    label: workLabel,
    status: "running",
  });

  try {
    const latest = agentRunStore.get(runId)!;
    const result =
      preset === "dca"
        ? await runDcaJob(latest.goal, latest.policy)
        : preset === "ta"
          ? await runTaJob(latest.goal, latest.policy)
          : preset === "dao_research"
            ? await runDaoJob(latest.goal, latest.policy)
            : await runGeneralJob(latest.goal, latest.policy);

    const artifact = {
      ...result.artifact,
      walletAddress: latest.wallet?.address,
      ...(result.artifact.kind === "dca"
        ? { walletLabel: latest.wallet?.label }
        : {}),
    } as AgentArtifact;

    agentRunStore.patchStep(runId, workId, {
      status: "done",
      detail: result.source === "fallback" ? "fallback artifact" : "live",
    });

    return agentRunStore.update(runId, {
      status: "succeeded",
      artifact,
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
