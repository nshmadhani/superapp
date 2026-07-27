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
  GeneralArtifact,
  PublicAgentRun,
  TaArtifact,
} from "./types";
export { toPublicAgentRun } from "./types";
export { agentRunStore } from "./store";
export { kickAgentRun, executeAgentRun } from "./worker";
export { fetchBinanceKlines, resolveBinanceSymbol } from "./market-data";
export { agentWalletLabel } from "./labels";
export { createEphemeralAgentWallet } from "./ephemeral-wallet";
export { e2bConfigured, runInE2b, parseJsonFromE2bText } from "./e2b";

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
