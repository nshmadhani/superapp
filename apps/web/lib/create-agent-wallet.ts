/**
 * @deprecated Agent wallets are ephemeral (see @cipher/agent-jobs createEphemeralAgentWallet).
 * Kept so old imports do not break builds.
 */
import type { AgentType } from "@cipher/agent-jobs/types";

export type LegacyAgentWalletClientResult = {
  cipherWalletId: string;
  address: string;
  chainFamily: "evm";
  turnkeyWalletId: string;
  label: string;
};

export async function createAgentWalletClient(_opts: {
  type: AgentType;
  createWallet: unknown;
  refreshWallets: unknown;
}): Promise<LegacyAgentWalletClientResult> {
  throw new Error(
    "createAgentWalletClient is deprecated — use ephemeral agent wallets (withWallet: true)",
  );
}
