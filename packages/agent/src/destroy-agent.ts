import {
  createWalletClient,
  http,
  type Hex,
  parseEther,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  createDb,
  getAgentWalletPrivateKey,
  listWallets,
  markAgentWalletDestroyed,
} from "@cipher/db";
import { agentRunStore, toPublicAgentRun } from "@cipher/agent-jobs";
import { getEvmPublicClient, resolveEvmRpcUrl } from "@cipher/rpc";

const RECLAIM_CHAINS = [8453, 1, 42161, 999] as const;
/** Skip reclaim when native balance is below this (wei). ~$0.01–gas floor. */
const MIN_RECLAIM_WEI = parseEther("0.00001");

export type DestroyAgentResult = {
  run: ReturnType<typeof toPublicAgentRun> | null;
  reclaim: {
    status:
      | "skipped_no_wallet"
      | "skipped_no_destination"
      | "skipped_zero_balance"
      | "reclaimed"
      | "partial"
      | "failed";
    txs?: Array<{ chainId: number; hash: string; amountEth: string }>;
    error?: string;
  };
};

export async function destroyAgentRun(opts: {
  userId: string;
  runId: string;
}): Promise<DestroyAgentResult> {
  const run = agentRunStore.get(opts.runId);
  if (!run || run.userId !== opts.userId) {
    return {
      run: null,
      reclaim: { status: "skipped_no_wallet", error: "not_found" },
    };
  }

  agentRunStore.update(opts.runId, {
    status: "cancelled",
    finishedAt: new Date().toISOString(),
    error: run.error ?? "cancelled_by_user",
  });

  const db = createDb();
  let material: Awaited<ReturnType<typeof getAgentWalletPrivateKey>> = null;
  try {
    material = await getAgentWalletPrivateKey(db, opts.userId, opts.runId);
  } catch (err) {
    const updated = agentRunStore.get(opts.runId);
    return {
      run: updated ? toPublicAgentRun(updated) : null,
      reclaim: {
        status: "failed",
        error: err instanceof Error ? err.message : "decrypt_failed",
      },
    };
  }

  if (!material) {
    const updated = agentRunStore.get(opts.runId);
    return {
      run: updated ? toPublicAgentRun(updated) : null,
      reclaim: { status: "skipped_no_wallet" },
    };
  }

  const userWallets = await listWallets(db, opts.userId);
  const destination = [...userWallets]
    .reverse()
    .find((w) => w.chainFamily === "evm" && w.source === "turnkey");
  if (!destination) {
    await markAgentWalletDestroyed(db, opts.userId, opts.runId, {
      wipeCiphertext: false,
    });
    const updated = agentRunStore.get(opts.runId);
    return {
      run: updated ? toPublicAgentRun(updated) : null,
      reclaim: { status: "skipped_no_destination" },
    };
  }

  const account = privateKeyToAccount(material.privateKey);
  const txs: Array<{ chainId: number; hash: string; amountEth: string }> = [];
  const errors: string[] = [];

  for (const chainId of RECLAIM_CHAINS) {
    try {
      const publicClient = getEvmPublicClient(chainId);
      const balance = await publicClient.getBalance({
        address: account.address,
      });
      if (balance <= MIN_RECLAIM_WEI) continue;

      // Leave a tiny buffer for gas; if too small, skip chain.
      const gasPrice = await publicClient.getGasPrice();
      const gasCost = gasPrice * 21_000n;
      if (balance <= gasCost + MIN_RECLAIM_WEI) continue;
      const value = balance - gasCost;

      const walletClient = createWalletClient({
        account,
        chain: publicClient.chain,
        transport: http(resolveEvmRpcUrl(chainId)),
      });
      const hash = await walletClient.sendTransaction({
        to: destination.address as Hex,
        value,
        chain: publicClient.chain,
      });
      txs.push({
        chainId,
        hash,
        amountEth: formatEther(value),
      });
    } catch (err) {
      errors.push(
        `chain_${chainId}:${err instanceof Error ? err.message : "reclaim_failed"}`,
      );
    }
  }

  await markAgentWalletDestroyed(db, opts.userId, opts.runId, {
    wipeCiphertext: txs.length > 0 || errors.length === 0,
  });

  // Clear in-memory private key if any
  if (run.wallet) {
    agentRunStore.setWallet(opts.runId, {
      ...run.wallet,
      privateKey: undefined,
    });
  }

  const updated = agentRunStore.get(opts.runId);
  let status: DestroyAgentResult["reclaim"]["status"] = "skipped_zero_balance";
  if (txs.length > 0 && errors.length === 0) status = "reclaimed";
  else if (txs.length > 0) status = "partial";
  else if (errors.length > 0) status = "failed";

  return {
    run: updated ? toPublicAgentRun(updated) : null,
    reclaim: {
      status,
      txs: txs.length ? txs : undefined,
      error: errors.length ? errors.join("; ") : undefined,
    },
  };
}
