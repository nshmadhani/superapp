"use client";

import { agentWalletLabel, type AgentType, type AgentWallet } from "@cipher/agent-jobs";
import { addressFormatForChain } from "@/lib/turnkey-wallets";
import { refreshWalletsThrottled } from "@/lib/turnkey-refresh";
import { waitForCipherSession } from "@/lib/cipher-session";
import { syncTurnkeyWalletsToCipher } from "@/lib/sync-wallets";

type TurnkeyWallet = {
  walletId?: string;
  walletName?: string;
  accounts?: Array<{ address?: string; addressFormat?: string } | null> | null;
};

/**
 * Create a dedicated Turnkey EVM wallet in the user's session (sub-org),
 * sync it into Cipher, and return an AgentWallet payload for POST /api/agents.
 */
export async function createAgentWalletClient(opts: {
  type: AgentType;
  createWallet: (params: {
    walletName: string;
    accounts: unknown[];
  }) => Promise<unknown>;
  refreshWallets: () => Promise<TurnkeyWallet[] | null | undefined>;
}): Promise<AgentWallet> {
  const short = crypto.randomUUID().replace(/-/g, "").slice(0, 6);
  const label = agentWalletLabel(opts.type, short);

  await opts.createWallet({
    walletName: label,
    accounts: [addressFormatForChain("evm")],
  });

  await waitForCipherSession(5_000);
  const list = await refreshWalletsThrottled(
    async () => {
      const raw = (await opts.refreshWallets()) ?? [];
      return raw.map((w) => ({
        walletId: String(w.walletId ?? ""),
        walletName: w.walletName ?? null,
        source: "embedded",
        accounts: (w.accounts ?? [])
          .filter((a): a is { address: string } => Boolean(a?.address))
          .map((a) => ({ address: a.address! })),
      }));
    },
    { force: true },
  );

  if (list.length) {
    await syncTurnkeyWalletsToCipher(list as never, { mode: "embedded" });
  }

  const match =
    list.find((w) => (w.walletName ?? "") === label) ??
    list.find((w) => (w.walletName ?? "").includes(short)) ??
    [...list].reverse().find((w) =>
      (w.accounts ?? []).some((a) => a.address.startsWith("0x")),
    );

  const account = match?.accounts?.find((a) => a.address.startsWith("0x"));
  if (!match?.walletId || !account?.address) {
    throw new Error("Agent wallet created in Turnkey but address not found");
  }

  const res = await fetch("/api/wallets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "upsert_turnkey",
      address: account.address,
      chainFamily: "evm",
      label,
      turnkeyWalletId: match.walletId,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to persist agent wallet");
  }

  return {
    cipherWalletId: data.wallet.id as string,
    address: data.wallet.address as string,
    chainFamily: "evm",
    turnkeyWalletId: match.walletId,
    label,
  };
}
