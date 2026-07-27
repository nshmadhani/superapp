import type { AgentType } from "./types";

export function agentWalletLabel(type: AgentType, shortId: string): string {
  const nice =
    type === "dao_research" ? "DAO" : type === "ta" ? "TA" : type.toUpperCase();
  return `Agent · ${nice} · ${shortId}`;
}
