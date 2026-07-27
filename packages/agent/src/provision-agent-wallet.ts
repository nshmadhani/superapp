import { createEvmWallet } from "@cipher/turnkey";
import {
  agentWalletLabel,
  type AgentType,
  type AgentWallet,
} from "@cipher/agent-jobs";
import { store } from "./store";

/**
 * Server-side dedicated Turnkey EVM wallet for an agent run.
 * Tries the user's sub-org first (signable in session), then parent org.
 */
export async function provisionAgentWallet(opts: {
  userId: string;
  type: AgentType;
  runId: string;
  turnkeySuborgId?: string | null;
}): Promise<AgentWallet> {
  const short = opts.runId.replace(/-/g, "").slice(0, 6);
  const label = agentWalletLabel(opts.type, short);

  let created: Awaited<ReturnType<typeof createEvmWallet>>;
  try {
    created = await createEvmWallet(
      label,
      opts.turnkeySuborgId
        ? { organizationId: opts.turnkeySuborgId, evmOnly: true }
        : { evmOnly: true },
    );
  } catch {
    created = await createEvmWallet(label, { evmOnly: true });
  }

  const wallet = await store.upsertWallet(opts.userId, {
    address: created.address,
    chainFamily: "evm",
    source: "turnkey",
    label,
    turnkeyWalletId: created.turnkeyWalletId,
  });

  return {
    cipherWalletId: wallet.id,
    address: wallet.address,
    chainFamily: "evm",
    turnkeyWalletId: created.turnkeyWalletId,
    label,
  };
}
