/** Human label for an optional agent wallet. */
export function agentWalletLabel(hint: string, shortId: string): string {
  const nice = hint.replace(/_/g, " ").trim() || "Agent";
  return `Agent ${nice} ${shortId}`;
}
