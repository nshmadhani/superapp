import {
  createWalletClient,
  http,
  type Hex,
  parseEther,
  formatEther,
  formatUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  createDb,
  getAgentWalletPrivateKey,
  listWallets,
  markAgentWalletDestroyed,
} from "@ervo/db";
import { agentRunStore, toPublicAgentRun } from "@ervo/agent-jobs";
import { getEvmPublicClient, resolveEvmRpcUrl } from "@ervo/rpc";
import { ensureAgentRuntime, hydrateAgentRun } from "./register-runtime";

const RECLAIM_CHAINS = [8453, 1, 42161, 999] as const;
/** Skip reclaim when native balance is below this (wei). ~$0.01–gas floor. */
const MIN_RECLAIM_WEI = parseEther("0.00001");

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

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

async function resolveUsdc(chainId: number): Promise<{
  address: Hex;
  decimals: number;
} | null> {
  try {
    const url = new URL("https://li.quest/v1/token");
    url.searchParams.set("chain", String(chainId));
    url.searchParams.set("token", "USDC");
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = (await res.json()) as {
      address?: string;
      decimals?: number;
    };
    if (!body.address) return null;
    return {
      address: body.address as Hex,
      decimals: Number(body.decimals ?? 6),
    };
  } catch {
    return null;
  }
}

export async function destroyAgentRun(opts: {
  userId: string;
  runId: string;
}): Promise<DestroyAgentResult> {
  ensureAgentRuntime();
  const db = createDb();
  const run = await hydrateAgentRun(db, opts.userId, opts.runId);
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
      const walletClient = createWalletClient({
        account,
        chain: publicClient.chain,
        transport: http(resolveEvmRpcUrl(chainId)),
      });

      // ERC20 USDC first (while native gas remains).
      const usdc = await resolveUsdc(chainId);
      if (usdc) {
        const tokenBal = await publicClient.readContract({
          address: usdc.address,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [account.address],
        });
        if (tokenBal > BigInt(0)) {
          const hash = await walletClient.writeContract({
            address: usdc.address,
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [destination.address as Hex, tokenBal],
            chain: publicClient.chain,
          });
          txs.push({
            chainId,
            hash,
            amountEth: `${formatUnits(tokenBal, usdc.decimals)} USDC`,
          });
        }
      }

      const balance = await publicClient.getBalance({
        address: account.address,
      });
      if (balance <= MIN_RECLAIM_WEI) continue;

      const gasPrice = await publicClient.getGasPrice();
      const gasCost = gasPrice * BigInt(21_000);
      if (balance <= gasCost + MIN_RECLAIM_WEI) continue;
      const value = balance - gasCost;

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
