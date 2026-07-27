import { createEphemeralAgentWallet } from "./ephemeral-wallet";
import { persistAgentRun } from "./persist";
import type { AgentRun, AgentStep, AgentWallet, CreateAgentInput } from "./types";

const runs = new Map<string, AgentRun>();

function now() {
  return new Date().toISOString();
}

function touch(run: AgentRun): AgentRun {
  persistAgentRun(run);
  return structuredClone(run);
}

export const agentRunStore = {
  create(input: CreateAgentInput): AgentRun {
    const ts = now();
    let wallet = input.wallet ?? null;
    if (!wallet && input.withWallet) {
      wallet = createEphemeralAgentWallet();
    }
    const run: AgentRun = {
      id: input.id ?? crypto.randomUUID(),
      userId: input.userId,
      type: input.type?.trim() || "general",
      goal: input.goal,
      policy: input.policy ?? {},
      status: "queued",
      steps: [],
      artifact: null,
      source: null,
      wallet,
      createdAt: ts,
      updatedAt: ts,
    };
    runs.set(run.id, run);
    return touch(run);
  },

  /** Load a run into memory (e.g. from DB after restart). */
  hydrate(run: AgentRun): AgentRun {
    const copy = structuredClone(run);
    // Never keep private keys in the shared map from hydrate.
    if (copy.wallet?.privateKey) {
      copy.wallet = { ...copy.wallet, privateKey: undefined };
    }
    runs.set(copy.id, copy);
    return structuredClone(copy);
  },

  get(id: string): AgentRun | null {
    const run = runs.get(id);
    return run ? structuredClone(run) : null;
  },

  list(userId: string): AgentRun[] {
    return [...runs.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => structuredClone(r));
  },

  update(
    id: string,
    patch: Partial<
      Pick<
        AgentRun,
        | "status"
        | "steps"
        | "artifact"
        | "source"
        | "sandboxId"
        | "error"
        | "finishedAt"
        | "wallet"
      >
    >,
  ): AgentRun | null {
    const run = runs.get(id);
    if (!run) return null;
    Object.assign(run, patch, { updatedAt: now() });
    return touch(run);
  },

  setWallet(id: string, wallet: AgentWallet): AgentRun | null {
    return this.update(id, { wallet });
  },

  appendStep(id: string, step: Omit<AgentStep, "at"> & { at?: string }): AgentRun | null {
    const run = runs.get(id);
    if (!run) return null;
    run.steps = [...run.steps, { ...step, at: step.at ?? now() }];
    run.updatedAt = now();
    return touch(run);
  },

  patchStep(
    id: string,
    stepId: string,
    patch: Partial<Pick<AgentStep, "status" | "detail">>,
  ): AgentRun | null {
    const run = runs.get(id);
    if (!run) return null;
    run.steps = run.steps.map((s) =>
      s.id === stepId ? { ...s, ...patch, at: now() } : s,
    );
    run.updatedAt = now();
    return touch(run);
  },
};
