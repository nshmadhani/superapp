import type { AgentRun } from "./types";

type Persister = (run: AgentRun) => void | Promise<void>;

let persister: Persister | null = null;

/** Register a callback invoked after every store mutation (DB sync). */
export function setAgentRunPersister(fn: Persister | null): void {
  persister = fn;
}

export function persistAgentRun(run: AgentRun): void {
  if (!persister) return;
  try {
    const result = persister(run);
    if (result && typeof (result as Promise<void>).then === "function") {
      void (result as Promise<void>).catch((err) => {
        console.error("agent_run_persist_failed", err);
      });
    }
  } catch (err) {
    console.error("agent_run_persist_failed", err);
  }
}
