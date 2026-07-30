import {
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  type Hex,
  type TransactionRequest,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { quoteLifiTransfer } from "@ervo/adapters";
import {
  createDb,
  getAgentWalletPrivateKey,
} from "@ervo/db";
import { getEvmPublicClient, resolveEvmRpcUrl } from "@ervo/rpc";
import {
  agentRunStore,
  e2bConfigured,
  runDcaJob,
  runInE2b,
  type AgentRun,
  type DcaArtifact,
} from "@ervo/agent-jobs";

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
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

type LivePolicy = {
  chainId: number;
  sellToken: string;
  buyToken: string;
  amountUsd: number;
  intervalSeconds: number;
  asset: string;
  cadence: string;
};

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function isCancelled(runId: string): boolean {
  const run = agentRunStore.get(runId);
  return !run || run.status === "cancelled";
}

function inferLivePolicy(
  goal: string,
  policy: Record<string, unknown>,
): LivePolicy {
  const intervalFromGoal = goal.match(
    /every\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)/i,
  );
  let intervalSeconds = Number(policy.intervalSeconds ?? 0);
  if (!intervalSeconds && intervalFromGoal) {
    const n = Number(intervalFromGoal[1]);
    const unit = intervalFromGoal[2]!.toLowerCase();
    intervalSeconds = unit.startsWith("m") ? n * 60 : n;
  }
  if (!intervalSeconds || !Number.isFinite(intervalSeconds)) {
    intervalSeconds = 60;
  }
  intervalSeconds = Math.max(5, Math.min(intervalSeconds, 3600));

  const amountUsd = Number(
    policy.amountUsd ??
      goal.match(/\$?\s*(\d+(?:\.\d+)?)\s*(usd|dollars?)?/i)?.[1] ??
      1,
  );

  const chainId = Number(
    policy.chainId ??
      policy.fromChainId ??
      (/hyper/i.test(goal) ? 999 : 8453),
  );

  const buyToken = String(
    policy.buyToken ??
      policy.asset ??
      goal.match(/\b(HYPE|ETH|BTC|SOL|WETH|LINK)\b/i)?.[1] ??
      (chainId === 999 ? "HYPE" : "ETH"),
  ).toUpperCase();

  const sellToken = String(
    policy.sellToken ??
      policy.fromToken ??
      (/usdc/i.test(goal) ? "USDC" : "USDC"),
  ).toUpperCase();

  const cadence =
    intervalSeconds < 60
      ? `every ${intervalSeconds}s`
      : String(policy.cadence ?? "custom");

  return {
    chainId,
    sellToken,
    buyToken,
    amountUsd: Number.isFinite(amountUsd) && amountUsd > 0 ? amountUsd : 1,
    intervalSeconds,
    asset: buyToken,
    cadence,
  };
}

async function resolveTokenMeta(
  chainId: number,
  symbolOrAddress: string,
): Promise<{ address: Hex; decimals: number; symbol: string }> {
  if (symbolOrAddress.startsWith("0x") && symbolOrAddress.length >= 42) {
    const publicClient = getEvmPublicClient(chainId);
    const decimals = await publicClient.readContract({
      address: symbolOrAddress as Hex,
      abi: ERC20_ABI,
      functionName: "decimals",
    });
    return {
      address: symbolOrAddress as Hex,
      decimals: Number(decimals),
      symbol: symbolOrAddress,
    };
  }

  const url = new URL("https://li.quest/v1/token");
  url.searchParams.set("chain", String(chainId));
  url.searchParams.set("token", symbolOrAddress);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`token_resolve_failed:${symbolOrAddress}:${res.status}`);
  }
  const body = (await res.json()) as {
    address?: string;
    decimals?: number;
    symbol?: string;
  };
  if (!body.address) throw new Error(`token_resolve_missing:${symbolOrAddress}`);
  return {
    address: body.address as Hex,
    decimals: Number(body.decimals ?? 6),
    symbol: String(body.symbol ?? symbolOrAddress),
  };
}

async function planInE2b(
  goal: string,
  live: LivePolicy,
): Promise<{ artifact: DcaArtifact; source: "live" | "fallback"; sandboxId?: string }> {
  // Prefer the existing DCA E2B recipe for the schedule artifact.
  const planned = await runDcaJob(goal, {
    asset: live.asset,
    amountUsd: live.amountUsd,
    cadence: live.cadence,
  });

  // Extra tick: ask E2B to confirm live-loop knobs (no secrets).
  if (e2bConfigured()) {
    try {
      const code = `
import json
out = {
  "ok": True,
  "chainId": ${live.chainId},
  "sellToken": ${JSON.stringify(live.sellToken)},
  "buyToken": ${JSON.stringify(live.buyToken)},
  "amountUsd": ${live.amountUsd},
  "intervalSeconds": ${live.intervalSeconds},
  "summary": ${JSON.stringify(
    `Live DCA: buy $${live.amountUsd} ${live.buyToken} every ${live.intervalSeconds}s on chain ${live.chainId} until ${live.sellToken} runs out.`,
  )},
}
print(json.dumps(out))
`;
      const exec = await runInE2b(code);
      return {
        artifact: {
          ...planned.artifact,
          cadence: live.cadence,
          amountUsd: live.amountUsd,
          asset: live.asset,
          summary:
            planned.artifact.summary ||
            `Live DCA: $${live.amountUsd} ${live.buyToken} every ${live.intervalSeconds}s`,
        },
        source: "live",
        sandboxId: exec.sandboxId,
      };
    } catch {
      /* fall through */
    }
  }

  return planned;
}

async function sendUnsigned(
  privateKey: `0x${string}`,
  chainId: number,
  tx: {
    to: string;
    data: string;
    value: string;
    gasLimit?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  },
): Promise<Hex> {
  const account = privateKeyToAccount(privateKey);
  const publicClient = getEvmPublicClient(chainId);
  const walletClient = createWalletClient({
    account,
    chain: publicClient.chain,
    transport: http(resolveEvmRpcUrl(chainId)),
  });

  const request: TransactionRequest = {
    to: tx.to as Hex,
    data: tx.data as Hex,
    value: BigInt(tx.value || "0"),
  };
  if (tx.gasLimit) request.gas = BigInt(tx.gasLimit);
  if (tx.gasPrice) request.gasPrice = BigInt(tx.gasPrice);
  if (tx.maxFeePerGas) request.maxFeePerGas = BigInt(tx.maxFeePerGas);
  if (tx.maxPriorityFeePerGas) {
    request.maxPriorityFeePerGas = BigInt(tx.maxPriorityFeePerGas);
  }

  return walletClient.sendTransaction(request);
}

/**
 * Live funded DCA: E2B plans the job; host signs LI.FI swaps with the
 * ephemeral key from Supabase. Stops on cancel, empty balance, or fatal error.
 */
export async function executeLiveDca(runId: string): Promise<AgentRun | null> {
  const run = agentRunStore.get(runId);
  if (!run?.wallet) return null;

  // Already finished a prior loop (e.g. after process restart).
  const priorSpend = [...run.steps]
    .reverse()
    .find((s) => s.label === "Spend complete" && s.status === "done");
  if (priorSpend) {
    return agentRunStore.update(runId, {
      status: "succeeded",
      finishedAt: run.finishedAt ?? new Date().toISOString(),
      error: undefined,
    });
  }

  const live = inferLivePolicy(run.goal, run.policy);
  const existingLegs =
    run.artifact?.kind === "dca"
      ? run.artifact.legs.filter((l) => Boolean(l.txHash))
      : [];

  const planStepId = crypto.randomUUID();
  agentRunStore.appendStep(runId, {
    id: planStepId,
    label: "Plan live DCA in E2B",
    status: "running",
  });

  let artifact: DcaArtifact;
  let source: "live" | "fallback" = "fallback";
  let sandboxId: string | undefined;
  try {
    const planned = await planInE2b(run.goal, live);
    artifact = {
      ...planned.artifact,
      // Keep prior executed txs; never invent a foresight schedule.
      legs: existingLegs,
      cadence: live.cadence,
      amountUsd: live.amountUsd,
      asset: live.asset,
      nextRunAt: new Date().toISOString(),
      walletAddress: run.wallet.address,
      walletLabel: run.wallet.label,
      summary:
        existingLegs.length > 0
          ? `Live DCA: ${existingLegs.length} buy(s) of $${live.amountUsd} ${live.buyToken} done.`
          : `Live DCA: $${live.amountUsd} ${live.buyToken} every ${live.intervalSeconds}s on chain ${live.chainId} until ${live.sellToken} runs out.`,
    };
    source = planned.source;
    sandboxId = planned.sandboxId;
    agentRunStore.patchStep(runId, planStepId, {
      status: "done",
      detail: source,
    });
    agentRunStore.update(runId, { artifact, source, sandboxId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "e2b_plan_failed";
    agentRunStore.patchStep(runId, planStepId, {
      status: "error",
      detail: message,
    });
    return agentRunStore.update(runId, {
      status: "failed",
      error: message,
      finishedAt: new Date().toISOString(),
    });
  }

  const fundStepId = crypto.randomUUID();
  agentRunStore.appendStep(runId, {
    id: fundStepId,
    label: `Wait for ${live.sellToken} + gas on chain ${live.chainId}`,
    status: "running",
    detail: run.wallet.address,
  });

  const db = createDb();
  let sellMeta: { address: Hex; decimals: number; symbol: string };
  try {
    sellMeta = await resolveTokenMeta(live.chainId, live.sellToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : "token_resolve_failed";
    agentRunStore.patchStep(runId, fundStepId, {
      status: "error",
      detail: message,
    });
    return agentRunStore.update(runId, {
      status: "failed",
      error: message,
      finishedAt: new Date().toISOString(),
    });
  }

  const amountRaw = parseUnits(String(live.amountUsd), sellMeta.decimals);
  const publicClient = getEvmPublicClient(live.chainId);

  // Wait until funded (or cancelled).
  for (;;) {
    if (isCancelled(runId)) {
      agentRunStore.patchStep(runId, fundStepId, {
        status: "skipped",
        detail: "cancelled",
      });
      return agentRunStore.get(runId);
    }

    const material = await getAgentWalletPrivateKey(db, run.userId, runId);
    if (!material) {
      agentRunStore.patchStep(runId, fundStepId, {
        status: "error",
        detail: "wallet_key_missing",
      });
      return agentRunStore.update(runId, {
        status: "failed",
        error: "wallet_key_missing",
        finishedAt: new Date().toISOString(),
      });
    }

    const [tokenBal, nativeBal] = await Promise.all([
      publicClient.readContract({
        address: sellMeta.address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [material.row.address as Hex],
      }),
      publicClient.getBalance({ address: material.row.address as Hex }),
    ]);

    if (tokenBal >= amountRaw && nativeBal > BigInt(0)) {
      agentRunStore.patchStep(runId, fundStepId, {
        status: "done",
        detail: `${formatUnits(tokenBal, sellMeta.decimals)} ${live.sellToken}; gas=${nativeBal.toString()}`,
      });
      break;
    }

    agentRunStore.patchStep(runId, fundStepId, {
      status: "running",
      detail: `waiting… ${formatUnits(tokenBal, sellMeta.decimals)} ${live.sellToken}, native=${nativeBal.toString()}`,
    });
    await sleep(8_000);
  }

  let legsDone = 0;
  let lastError: string | undefined;

  while (!isCancelled(runId)) {
    const material = await getAgentWalletPrivateKey(db, run.userId, runId);
    if (!material) {
      lastError = "wallet_key_missing";
      break;
    }

    const tokenBal = await publicClient.readContract({
      address: sellMeta.address,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [material.row.address as Hex],
    });

    if (tokenBal < amountRaw) {
      agentRunStore.appendStep(runId, {
        id: crypto.randomUUID(),
        label: "Spend complete",
        status: "done",
        detail: `Remaining ${formatUnits(tokenBal, sellMeta.decimals)} ${live.sellToken} < $${live.amountUsd}`,
      });
      break;
    }

    const stepId = crypto.randomUUID();
    agentRunStore.appendStep(runId, {
      id: stepId,
      label: `Swap $${live.amountUsd} ${live.sellToken} → ${live.buyToken}`,
      status: "running",
    });

    try {
      const quote = await quoteLifiTransfer({
        fromChainId: live.chainId,
        toChainId: live.chainId,
        fromToken: live.sellToken,
        toToken: live.buyToken,
        fromAmount: amountRaw.toString(),
        fromAddress: material.row.address,
        toAddress: material.row.address,
      });

      if (!quote.unsignedTx?.to || !quote.unsignedTx.data) {
        throw new Error("lifi_missing_transaction");
      }

      // Approve spender if needed (router = tx.to).
      const spender = quote.unsignedTx.to as Hex;
      const allowance = await publicClient.readContract({
        address: sellMeta.address,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [material.row.address as Hex, spender],
      });
      if (allowance < amountRaw) {
        const account = privateKeyToAccount(material.privateKey);
        const walletClient = createWalletClient({
          account,
          chain: publicClient.chain,
          transport: http(resolveEvmRpcUrl(live.chainId)),
        });
        const approveHash = await walletClient.writeContract({
          address: sellMeta.address,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [spender, amountRaw * BigInt(1000)],
          chain: publicClient.chain,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      const hash = await sendUnsigned(
        material.privateKey,
        live.chainId,
        quote.unsignedTx,
      );
      legsDone += 1;
      agentRunStore.patchStep(runId, stepId, {
        status: "done",
        detail: `${hash} (leg ${legsDone})`,
      });

      const legs = [
        ...(artifact.legs ?? []),
        {
          date: new Date().toISOString(),
          amountUsd: live.amountUsd,
          txHash: hash,
        },
      ].slice(-50);
      artifact = {
        ...artifact,
        legs,
        nextRunAt: new Date(
          Date.now() + live.intervalSeconds * 1000,
        ).toISOString(),
        summary: `Live DCA: ${legsDone} buy(s) of $${live.amountUsd} ${live.buyToken} done.`,
      };
      agentRunStore.update(runId, { artifact, source: "live", sandboxId });
    } catch (err) {
      lastError = err instanceof Error ? err.message : "swap_failed";
      agentRunStore.patchStep(runId, stepId, {
        status: "error",
        detail: lastError,
      });
      // Back off then retry; cancel still wins.
      await sleep(Math.min(live.intervalSeconds * 1000, 30_000));
      continue;
    }

    await sleep(live.intervalSeconds * 1000);
  }

  const latest = agentRunStore.get(runId);
  if (!latest) return null;
  if (latest.status === "cancelled") return latest;

  return agentRunStore.update(runId, {
    status: lastError && legsDone === 0 ? "failed" : "succeeded",
    artifact,
    source,
    sandboxId,
    error: lastError && legsDone === 0 ? lastError : undefined,
    finishedAt: new Date().toISOString(),
  });
}
