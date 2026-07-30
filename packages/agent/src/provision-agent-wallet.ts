import { createEvmWallet } from "@ervo/turnkey";
import {
  agentWalletLabel,
  type AgentType,
  type AgentWallet,
} from "@ervo/agent-jobs";
import { store } from "./store";

/**
 * @deprecated Prefer createEphemeralAgentWallet from @ervo/agent-jobs.
 * Kept for emergency/legacy Turnkey provisioning.
 */
export async function provisionAgentWallet(opts: {
  userId: string;
  type: AgentType;
  runId: string;
  turnkeySuborgId?: string | null;
}): Promise<AgentWallet> {
  const short = opts.runId.replace(/-/g, "").slice(0, 6);
  const label = agentWalletLabel(String(opts.type), short);

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
    address: wallet.address,
    chainFamily: "evm",
    label,
    source: "ephemeral",
    ervoWalletId: wallet.id,
    turnkeyWalletId: created.turnkeyWalletId,
  };
}
