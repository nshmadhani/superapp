import { agentRunStore } from "./store";
import type { AgentRun, AgentStep } from "./types";

function lastStep(run: AgentRun): AgentStep | undefined {
  return run.steps[run.steps.length - 1];
}

/**
 * Fix runs stuck in queued/running after a process crash mid-finalize.
 * Returns the reconciled run (may be unchanged).
 */
export function reconcileAgentRun(runId: string): AgentRun | null {
  const run = agentRunStore.get(runId);
  if (!run) return null;
  if (
    run.status !== "queued" &&
    run.status !== "running" &&
    run.status !== "needs_confirm"
  ) {
    return run;
  }

  const last = lastStep(run);
  if (!last) return run;

  if (last.label === "Spend complete" && last.status === "done") {
    return agentRunStore.update(runId, {
      status: "succeeded",
      finishedAt: run.finishedAt ?? new Date().toISOString(),
      error: undefined,
    });
  }

  if (last.status === "error") {
    return agentRunStore.update(runId, {
      status: "failed",
      error: last.detail ?? run.error ?? "agent_run_failed",
      finishedAt: run.finishedAt ?? new Date().toISOString(),
    });
  }

  // Work step finished and we already have an artifact → succeeded.
  if (
    last.status === "done" &&
    run.artifact &&
    /E2B|autonomous|Research|OHLCV|DCA schedule/i.test(last.label)
  ) {
    return agentRunStore.update(runId, {
      status: "succeeded",
      finishedAt: run.finishedAt ?? new Date().toISOString(),
      error: undefined,
    });
  }

  // Work step marked done (live/fallback) but artifact missing → incomplete fail.
  if (
    last.status === "done" &&
    !run.artifact &&
    /E2B|autonomous|Research|OHLCV|DCA schedule/i.test(last.label) &&
    /fallback|live/i.test(last.detail ?? "")
  ) {
    return agentRunStore.update(runId, {
      status: "failed",
      error: "artifact_missing_after_work",
      finishedAt: run.finishedAt ?? new Date().toISOString(),
    });
  }

  return run;
}

/** Whether this run should be resumed by the worker after hydrate. */
export function shouldResumeAgentRun(run: AgentRun): boolean {
  const reconciled = reconcileAgentRun(run.id) ?? run;
  if (reconciled.status === "queued") return true;
  if (reconciled.status !== "running") return false;

  // Live funded DCA still mid-loop.
  if (reconciled.wallet && reconciled.policy?.live === true) {
    const last = lastStep(reconciled);
    if (last?.label === "Spend complete") return false;
    return true;
  }
  if (
    reconciled.wallet &&
    (String(reconciled.policy?.preset ?? reconciled.type) === "dca" ||
      typeof reconciled.policy?.intervalSeconds === "number")
  ) {
    const last = lastStep(reconciled);
    if (last?.label === "Spend complete") return false;
    return true;
  }

  // One-shot jobs: only resume if work never finished.
  const last = lastStep(reconciled);
  if (!last) return true;
  if (last.status === "running" || last.status === "pending") return true;
  return false;
}
