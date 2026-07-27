export type {
  AgentArtifact,
  AgentArtifactSource,
  AgentRun,
  AgentRunStatus,
  AgentStep,
  AgentType,
  AgentWallet,
  CreateAgentInput,
  DaoArtifact,
  DcaArtifact,
  TaArtifact,
} from "./types";
export { agentRunStore } from "./store";
export { kickAgentRun, executeAgentRun } from "./worker";
export { e2bConfigured } from "./e2b";
export { fetchBinanceKlines, resolveBinanceSymbol } from "./market-data";
export { agentWalletLabel } from "./labels";

import { agentRunStore } from "./store";
import { kickAgentRun } from "./worker";
import type { AgentRun, CreateAgentInput } from "./types";

export function createAgentRun(input: CreateAgentInput): AgentRun {
  return agentRunStore.create(input);
}

export function createAndStartAgentRun(input: CreateAgentInput): AgentRun {
  const run = agentRunStore.create(input);
  kickAgentRun(run.id);
  return run;
}

export function startAgentRun(runId: string): AgentRun | null {
  const run = agentRunStore.get(runId);
  if (!run) return null;
  kickAgentRun(runId);
  return run;
}
