export type {
  AgentArtifact,
  AgentArtifactSource,
  AgentRun,
  AgentRunStatus,
  AgentStep,
  AgentType,
  CreateAgentInput,
  DaoArtifact,
  DcaArtifact,
  TaArtifact,
} from "./types";
export { agentRunStore } from "./store";
export { kickAgentRun, executeAgentRun } from "./worker";
export { e2bConfigured } from "./e2b";
export { fetchBinanceKlines, resolveBinanceSymbol } from "./market-data";

import { agentRunStore } from "./store";
import { kickAgentRun } from "./worker";
import type { AgentRun, CreateAgentInput } from "./types";

export function createAndStartAgentRun(input: CreateAgentInput): AgentRun {
  const run = agentRunStore.create(input);
  kickAgentRun(run.id);
  return run;
}
