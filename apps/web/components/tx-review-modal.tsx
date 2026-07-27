"use client";

import {
  buildAgentLifiStatus,
  type AgentLifiStatus,
} from "@cipher/adapters";
import { isLifiEvmChain, isLifiSolanaChain, type PlanStepExecution } from "@cipher/core";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import { ExternalLink, Loader2, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  executeLifiAfterConfirm,
  resolveSignAccount,
  waitForEvmReceipt,
} from "@/lib/lifi-execute";
import { encodeTransferSubmitted } from "@/lib/transfer-submitted";

const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function usePlanExpiry(expiresAt: string) {
  const expiresMs = useMemo(() => {
    const t = Date.parse(expiresAt);
    return Number.isFinite(t) ? t : NaN;
  }, [expiresAt]);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!Number.isFinite(expiresMs)) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresMs]);

  const remainingMs = Number.isFinite(expiresMs) ? expiresMs - now : 0;
  const expired = Number.isFinite(expiresMs) ? remainingMs <= 0 : false;

  return {
    expired,
    remainingMs: Math.max(0, remainingMs),
    label: Number.isFinite(expiresMs)
      ? expired
        ? "Expired"
        : formatCountdown(remainingMs)
      : "—",
  };
}

type PlanReview = {
  confirmId: string;
  planId: string;
  planHash: string;
  plan: {
    summary?: string;
    walletId: string;
    steps: unknown[];
    expiresAt: string;
    lifiStep?: unknown;
    lifiRoute?: unknown;
    stepExecutions?: PlanStepExecution[];
    unsignedTx?: {
      to: string;
      data: string;
      value: string;
      chainId: number;
      gasLimit?: string;
      gasPrice?: string;
      maxFeePerGas?: string;
      maxPriorityFeePerGas?: string;
      minBuyAmount?: string;
      displayRoute?: string;
      toolName?: string;
      tool?: string;
      toChainId?: number;
      executionDurationSec?: number;
      isCrossChain?: boolean;
    };
  };
  quote: {
    to: string;
    data: string;
    value: string;
    minBuyAmount: string;
    displayRoute: string;
    chainId: number;
    toChainId?: number;
    tool?: string;
    toolName?: string;
    executionDurationSec?: number;
    isCrossChain?: boolean;
    toAmount?: string;
    multiStep?: boolean;
    stepCount?: number;
    /** True when Morpho approve+deposit with no LI.FI transfer. */
    lendOnly?: boolean;
  };
  wallet: { address: string; id: string };
  wallets?: Record<string, { address: string; id: string }>;
};

export type TxReviewOutcome = {
  status: "approved" | "rejected";
  planId: string;
  txHash?: string;
  explorerUrl?: string;
  /** Machine-readable payload for the agent (approved only). */
  agentPayload?: string;
};

const EVM_EXPLORERS: Record<number, string> = {
  1: "https://etherscan.io/tx/",
  8453: "https://basescan.org/tx/",
  42161: "https://arbiscan.io/tx/",
  10: "https://optimistic.etherscan.io/tx/",
  137: "https://polygonscan.com/tx/",
  999: "https://hyperevmscan.io/tx/",
};

export function explorerUrlForTx(
  chainId: number,
  txHash: string,
): string | undefined {
  if (!txHash) return undefined;
  if (isLifiSolanaChain(chainId)) {
    return `https://solscan.io/tx/${txHash}`;
  }
  const base = EVM_EXPLORERS[chainId];
  return base ? `${base}${txHash}` : undefined;
}

type LifiUiStatus =
  | "idle"
  | "NOT_FOUND"
  | "INVALID"
  | "PENDING"
  | "DONE"
  | "FAILED"
  | "PARTIAL"
  | "REFUNDED"
  | "unknown";

function shortAddr(addr: string) {
  if (!addr || addr.length < 12) return addr || "—";
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function labelForLifiStatus(s: LifiUiStatus): string {
  switch (s) {
    case "PENDING":
    case "NOT_FOUND":
      return "Waiting for LI.FI…";
    case "DONE":
      return "Complete";
    case "FAILED":
      return "Failed";
    case "PARTIAL":
      return "Partial";
    case "REFUNDED":
      return "Refunded on source — bridge did not reach destination";
    case "INVALID":
      return "Invalid";
    default:
      return s === "idle" ? "—" : String(s);
  }
}

type LifiWatchSnapshot = {
  status: LifiUiStatus;
  terminalKind?: string;
  rawStatus?: string;
  receivingTxHash?: string;
  sendingTxHash?: string;
  substatus?: string;
  substatusMessage?: string;
  failReason?: string | null;
  sendingChainId?: number | null;
  receivingChainId?: number | null;
  lifiExplorerLink?: string | null;
  tool?: string;
};

function agentLifiFromWatch(
  txHash: string,
  snap: LifiWatchSnapshot | null | undefined,
): AgentLifiStatus | undefined {
  if (!snap) return undefined;
  const terminalKind =
    snap.terminalKind ??
    (snap.status === "DONE"
      ? "success"
      : snap.status === "REFUNDED"
        ? "refunded"
        : snap.status === "FAILED"
          ? "failed"
          : snap.status === "PARTIAL"
            ? "partial"
            : snap.status === "PENDING" || snap.status === "NOT_FOUND"
              ? "pending"
              : "unknown");
  return buildAgentLifiStatus({
    txHash,
    status: snap.status,
    uiStatus: snap.status,
    rawStatus: snap.rawStatus,
    substatus: snap.substatus,
    substatusMessage: snap.substatusMessage,
    terminalKind,
    tool: snap.tool,
    failReason: snap.failReason,
    sendingChainId: snap.sendingChainId,
    receivingChainId: snap.receivingChainId,
    sendingTxHash: snap.sendingTxHash ?? txHash,
    receivingTxHash: snap.receivingTxHash,
    lifiExplorerLink: snap.lifiExplorerLink,
  });
}

async function fetchLifiStatusOnce(opts: {
  txHash: string;
  fromChain: number;
  toChain: number;
  bridgeTool?: string;
}): Promise<LifiWatchSnapshot> {
  const params = new URLSearchParams({
    txHash: opts.txHash,
    fromChain: String(opts.fromChain),
    toChain: String(opts.toChain),
  });
  if (opts.bridgeTool) params.set("bridge", opts.bridgeTool);
  const res = await fetch(`/api/lifi/status?${params}`);
  const data = (await res.json()) as {
    status?: string;
    rawStatus?: string;
    terminalKind?: string;
    substatus?: string;
    substatusMessage?: string;
    failReason?: string | null;
    receiving?: { txHash?: string; chainId?: number };
    sending?: { txHash?: string; chainId?: number };
    receivingChainId?: number | null;
    sendingChainId?: number | null;
    receivingTxHash?: string | null;
    sendingTxHash?: string | null;
    lifiExplorerLink?: string | null;
    tool?: string;
  };
  return {
    status: (data.status ?? "unknown") as LifiUiStatus,
    terminalKind: data.terminalKind,
    rawStatus: data.rawStatus,
    receivingTxHash: data.receivingTxHash ?? data.receiving?.txHash,
    sendingTxHash: data.sendingTxHash ?? data.sending?.txHash ?? opts.txHash,
    substatus: data.substatus,
    substatusMessage: data.substatusMessage,
    failReason: data.failReason,
    sendingChainId: data.sendingChainId ?? data.sending?.chainId ?? null,
    receivingChainId: data.receivingChainId ?? data.receiving?.chainId ?? null,
    lifiExplorerLink: data.lifiExplorerLink ?? null,
    tool: data.tool,
  };
}

async function waitForLifiDone(opts: {
  txHash: string;
  fromChain: number;
  toChain: number;
  bridgeTool?: string;
  onStatus: (s: LifiUiStatus, receiving?: string) => void;
  timeoutMs?: number;
}): Promise<LifiWatchSnapshot & { ok: boolean }> {
  const deadline = Date.now() + (opts.timeoutMs ?? 180_000);
  let last = await fetchLifiStatusOnce(opts).catch(() => null);
  while (Date.now() < deadline) {
    try {
      last = await fetchLifiStatusOnce(opts);
      opts.onStatus(last.status, last.receivingTxHash);
      if (last.status === "DONE") return { ok: true, ...last };
      if (
        last.status === "FAILED" ||
        last.status === "REFUNDED" ||
        last.status === "PARTIAL"
      ) {
        return { ok: false, ...last };
      }
    } catch {
      opts.onStatus("unknown");
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  return {
    ok: false,
    status: last?.status ?? "PENDING",
    terminalKind: last?.terminalKind ?? "pending",
    rawStatus: last?.rawStatus,
    receivingTxHash: last?.receivingTxHash,
    sendingTxHash: last?.sendingTxHash ?? opts.txHash,
    substatus: last?.substatus,
    substatusMessage: last?.substatusMessage,
    failReason: last?.failReason,
    sendingChainId: last?.sendingChainId,
    receivingChainId: last?.receivingChainId,
    lifiExplorerLink: last?.lifiExplorerLink,
    tool: last?.tool,
  };
}

export function TxReviewCard({
  review,
  onDismiss,
  onOutcome,
  alreadySubmitted,
}: {
  review: PlanReview;
  onDismiss?: () => void;
  onOutcome?: (outcome: TxReviewOutcome) => void;
  /** Plan already has a transfer_submitted in chat — show read-only, no actions. */
  alreadySubmitted?: boolean;
}) {
  const { signTransaction, wallets } = useTurnkey();
  const expiry = usePlanExpiry(review.plan.expiresAt);
  const [status, setStatus] = useState<
    | "idle"
    | "confirming"
    | "signing"
    | "waiting_bridge"
    | "rejecting"
    | "done"
    | "rejected"
    | "error"
  >(alreadySubmitted ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [lifiStatus, setLifiStatus] = useState<LifiUiStatus>("idle");
  const [receivingTxHash, setReceivingTxHash] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [stepNotes, setStepNotes] = useState<string[]>([]);
  const [stepTxs, setStepTxs] = useState<
    Array<{ txHash: string; explorerUrl?: string }>
  >([]);

  useEffect(() => {
    if (alreadySubmitted) setStatus("done");
  }, [alreadySubmitted]);

  const q = review.quote;
  const utx = review.plan.unsignedTx;
  const fromChain = q.chainId;
  const toChain = q.toChainId ?? utx?.toChainId ?? fromChain;
  const cross = q.isCrossChain ?? utx?.isCrossChain ?? fromChain !== toChain;
  const lendOnly = Boolean(q.lendOnly);
  /** Raw bridge adapter id for LI.FI status API only — never a product brand. */
  const bridgeTool = q.tool ?? utx?.tool;
  const eta = q.executionDurationSec ?? utx?.executionDurationSec;
  const routeLabel = review.plan.summary ?? q.displayRoute;
  const settled =
    status === "done" || status === "rejected" || Boolean(alreadySubmitted);
  const actionsLocked = settled || expiry.expired;
  const busy =
    status === "confirming" ||
    status === "signing" ||
    status === "waiting_bridge" ||
    status === "rejecting";

  const legs = useMemo((): PlanStepExecution[] => {
    if (review.plan.stepExecutions?.length) return review.plan.stepExecutions;
    return [
      {
        stepIndex: 0,
        walletId: review.wallet.id,
        kind: cross ? "bridge" : "swap",
        label: routeLabel,
        unsignedTx: {
          to: utx?.to ?? q.to,
          data: utx?.data ?? q.data,
          value: utx?.value ?? q.value,
          chainId: fromChain,
          toChainId: toChain,
          tool: bridgeTool,
          toolName: utx?.toolName ?? q.toolName,
          isCrossChain: cross,
          minBuyAmount: q.minBuyAmount,
          displayRoute: routeLabel,
          executionDurationSec: eta,
          gasLimit: utx?.gasLimit,
          gasPrice: utx?.gasPrice,
          maxFeePerGas: utx?.maxFeePerGas,
          maxPriorityFeePerGas: utx?.maxPriorityFeePerGas,
        },
        lifiStep: review.plan.lifiStep,
        lifiRoute: review.plan.lifiRoute,
        waitForLifi: cross,
      },
    ];
  }, [
    review.plan.stepExecutions,
    review.plan.lifiStep,
    review.plan.lifiRoute,
    review.wallet.id,
    cross,
    routeLabel,
    utx,
    q,
    fromChain,
    toChain,
    bridgeTool,
    eta,
  ]);

  /** True when a leg is an actual LI.FI swap/bridge (not Morpho approve/lend). */
  const hasLifiLeg = useMemo(() => {
    if (lendOnly) return false;
    return legs.some(
      (l) =>
        Boolean(l.lifiStep) ||
        Boolean(l.waitForLifi) ||
        l.kind === "swap" ||
        l.kind === "bridge",
    );
  }, [legs, lendOnly]);

  /** Cross-chain LI.FI only — same-chain swaps just need on-chain receipt. */
  const needsLifiBridgeWatch = useMemo(
    () => hasLifiLeg && (cross || legs.some((l) => Boolean(l.waitForLifi))),
    [hasLifiLeg, cross, legs],
  );

  useEffect(() => {
    // Background LI.FI poll is only for cross-chain bridges after submit.
    if (!needsLifiBridgeWatch) return;
    if (status !== "done" || !txHash || legs.length > 1) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const params = new URLSearchParams({
          txHash: txHash!,
          fromChain: String(fromChain),
          toChain: String(toChain),
        });
        if (bridgeTool) params.set("bridge", bridgeTool);
        const res = await fetch(`/api/lifi/status?${params}`);
        const data = (await res.json()) as {
          status?: string;
          receiving?: { txHash?: string };
        };
        if (cancelled) return;
        if (!res.ok) {
          setLifiStatus("unknown");
        } else {
          const st = (data.status ?? "unknown") as LifiUiStatus;
          setLifiStatus(st);
          if (data.receiving?.txHash) {
            setReceivingTxHash(data.receiving.txHash);
          }
          if (st === "DONE" || st === "FAILED" || st === "REFUNDED") {
            return;
          }
        }
      } catch {
        if (!cancelled) setLifiStatus("unknown");
      }
      if (!cancelled) {
        timer = setTimeout(() => void poll(), 4000);
      }
    }

    setLifiStatus("PENDING");
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    needsLifiBridgeWatch,
    status,
    txHash,
    fromChain,
    toChain,
    bridgeTool,
    legs.length,
  ]);

  function resolveAddress(
    walletId: string,
    confirmedWallets?: Array<{ id: string; address: string }>,
  ): string {
    const fromConfirm = confirmedWallets?.find((w) => w.id === walletId);
    if (fromConfirm) return fromConfirm.address;
    const fromReview = review.wallets?.[walletId]?.address;
    if (fromReview) return fromReview;
    if (walletId === review.wallet.id) return review.wallet.address;
    throw new Error(`wallet_address_missing:${walletId}`);
  }

  async function onConfirm() {
    if (expiry.expired) {
      setError("This plan has expired. Ask for a new quote.");
      setStatus("error");
      return;
    }
    setError(null);
    setStatus("confirming");
    setStepNotes([]);
    setStepTxs([]);
    try {
      const res = await fetch(`/api/plans/${review.planId}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirmId: review.confirmId,
          planHash: review.planHash,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Confirm failed");
      }

      const confirmedLegs: PlanStepExecution[] =
        data.plan?.stepExecutions?.length > 0
          ? data.plan.stepExecutions
          : legs;
      const confirmedWallets = data.wallets as
        | Array<{ id: string; address: string }>
        | undefined;

      let firstHash: string | undefined;
      let firstExplorer: string | undefined;
      let lastHash: string | undefined;
      let lastExplorer: string | undefined;
      const collectedSteps: Array<{
        kind: string;
        label: string;
        txHash: string;
        explorerUrl?: string;
      }> = [];
      let lifiOutcome: Awaited<ReturnType<typeof waitForLifiDone>> | null =
        null;

      for (let i = 0; i < confirmedLegs.length; i++) {
        const leg = confirmedLegs[i]!;
        setActiveStep(i);
        setStatus("signing");
        setStepNotes((prev) => [
          ...prev,
          `Signing step ${i + 1}/${confirmedLegs.length}: ${leg.label}`,
        ]);

        const walletAddress = resolveAddress(leg.walletId, confirmedWallets);
        try {
          const result = await executeLifiAfterConfirm({
            lifiStep: leg.lifiStep,
            unsignedTx: leg.unsignedTx,
            walletAddress,
            signTransaction: signTransaction as never,
            walletAccount: resolveSignAccount(wallets ?? [], walletAddress),
            solanaRpcUrl: SOLANA_RPC_URL,
          });

          if (result.txHash) {
            const explorer = explorerUrlForTx(
              leg.unsignedTx.chainId,
              result.txHash,
            );
            collectedSteps.push({
              kind: leg.kind,
              label: leg.label,
              txHash: result.txHash,
              explorerUrl: explorer,
            });
            setStepTxs(
              collectedSteps.map((s) => ({
                txHash: s.txHash,
                explorerUrl: s.explorerUrl,
              })),
            );
            lastHash = result.txHash;
            lastExplorer = explorer;
            if (i === 0) {
              firstHash = result.txHash;
              firstExplorer = explorer;
              setTxHash(firstHash);
              if (firstExplorer) setExplorerUrl(firstExplorer);
            }
            // Prefer deposit/lend hash as primary for Morpho plans.
            if (leg.kind === "lend" && explorer) {
              setTxHash(result.txHash);
              setExplorerUrl(explorer);
            }
          }

          if (leg.waitForLifi) {
            if (!result.txHash) {
              throw new Error(
                "Bridge source tx hash missing — cannot wait for LI.FI before lend.",
              );
            }
            setStatus("waiting_bridge");
            setLifiStatus("PENDING");
            const bridgeResult = await waitForLifiDone({
              txHash: result.txHash,
              fromChain: leg.unsignedTx.chainId,
              toChain: leg.unsignedTx.toChainId ?? toChain,
              bridgeTool: leg.unsignedTx.tool ?? bridgeTool,
              onStatus: (st, receiving) => {
                setLifiStatus(st);
                if (receiving) setReceivingTxHash(receiving);
              },
            });
            lifiOutcome = bridgeResult;
            if (!bridgeResult.ok) {
              const reason =
                bridgeResult.failReason ??
                bridgeResult.substatus ??
                bridgeResult.status;
              setLifiStatus(bridgeResult.status);
              setError(
                bridgeResult.status === "REFUNDED"
                  ? `Bridge refunded (${reason}). Funds returned on source — try again with higher slippage or a larger amount.`
                  : `Bridge did not complete (${reason}).`,
              );
              setStatus("error");
              const lifi = agentLifiFromWatch(result.txHash, bridgeResult);
              onOutcome?.({
                status: "approved",
                planId: review.planId,
                txHash: firstHash,
                explorerUrl: firstExplorer,
                agentPayload: encodeTransferSubmitted({
                  planId: review.planId,
                  txHash: firstHash,
                  explorerUrl: firstExplorer,
                  fromChainId: fromChain,
                  toChainId: toChain,
                  route: routeLabel,
                  isCrossChain: cross,
                  stepCount: legs.length,
                  completedAllSteps: false,
                  lifi,
                }),
              });
              return;
            }
            setStepNotes((prev) => [...prev, "Bridge settled — continuing."]);
          } else if (
            result.txHash &&
            isLifiEvmChain(leg.unsignedTx.chainId)
          ) {
            // Default for every non-bridge EVM leg (approve, lend, same-chain
            // swap): wait until the tx is mined — not a LI.FI status poll.
            const isLast = i === confirmedLegs.length - 1;
            setStepNotes((prev) => [
              ...prev,
              isLast
                ? `Waiting for on-chain confirmation…`
                : `Waiting for step ${i + 1} confirmation…`,
            ]);
            await waitForEvmReceipt({
              chainId: leg.unsignedTx.chainId,
              txHash: result.txHash,
            });
            setStepNotes((prev) => [
              ...prev,
              isLast
                ? `Confirmed on-chain.`
                : `Step ${i + 1} confirmed — continuing.`,
            ]);
          }
        } catch (stepErr) {
          const raw =
            stepErr instanceof Error ? stepErr.message : String(stepErr);
          throw new Error(
            `Step ${i + 1}/${confirmedLegs.length} (${leg.kind}: ${leg.label}) failed: ${raw}`,
          );
        }
      }

      // LI.FI status is only for cross-chain bridges (already watched via
      // waitForLifi). Same-chain swaps / Morpho / etc. are done after receipt.
      if (
        needsLifiBridgeWatch &&
        !lifiOutcome &&
        firstHash
      ) {
        lifiOutcome = await waitForLifiDone({
          txHash: firstHash,
          fromChain,
          toChain,
          bridgeTool,
          onStatus: (st, receiving) => {
            setLifiStatus(st);
            if (receiving) setReceivingTxHash(receiving);
          },
        });
      }

      const bridgeOk = !lifiOutcome || lifiOutcome.ok !== false;
      setStatus(bridgeOk ? "done" : "error");
      if (!bridgeOk) {
        setError(
          `Bridge ${lifiOutcome?.status ?? "failed"}${
            lifiOutcome?.failReason ? ` (${lifiOutcome.failReason})` : ""
          }.`,
        );
      }
      const primaryHash = lastHash ?? firstHash;
      const primaryExplorer = lastExplorer ?? firstExplorer;
      const lifi =
        needsLifiBridgeWatch && firstHash
          ? agentLifiFromWatch(firstHash, lifiOutcome)
          : undefined;
      onOutcome?.({
        status: "approved",
        planId: review.planId,
        txHash: primaryHash,
        explorerUrl: primaryExplorer,
        agentPayload: encodeTransferSubmitted({
          planId: review.planId,
          txHash: primaryHash,
          explorerUrl: primaryExplorer,
          fromChainId: fromChain,
          toChainId: toChain,
          route: routeLabel,
          isCrossChain: cross,
          stepCount: legs.length,
          completedAllSteps: bridgeOk,
          steps: collectedSteps,
          // Brand LI.FI only for real LI.FI transfer legs — never Morpho/etc.
          via: hasLifiLeg ? "LI.FI" : undefined,
          tool: hasLifiLeg ? "LI.FI" : undefined,
          success: bridgeOk,
          lifi,
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed");
      setStatus("error");
    }
  }

  async function onReject() {
    setError(null);
    setStatus("rejecting");
    try {
      const res = await fetch(`/api/plans/${review.planId}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirmId: review.confirmId,
          planHash: review.planHash,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Reject failed");
      }
      setStatus("rejected");
      onOutcome?.({
        status: "rejected",
        planId: review.planId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
      setStatus("error");
    }
  }

  const lifiWaiting =
    lifiStatus === "PENDING" ||
    lifiStatus === "NOT_FOUND" ||
    lifiStatus === "idle";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-zinc-100">
          {status === "done" || alreadySubmitted
            ? "Plan submitted"
            : status === "rejected"
              ? "Transfer rejected"
              : legs.length > 1
                ? `Transaction review · ${legs.length} signatures`
                : "Transaction review"}
        </h3>
        {onDismiss && !settled && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-zinc-500 hover:text-zinc-200"
          >
            Dismiss
          </button>
        )}
      </div>
      <p className="text-sm text-zinc-200">{routeLabel}</p>

      {legs.length > 1 && (
        <>
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Wallets used
            </p>
            <ul className="space-y-1">
              {[
                {
                  id: review.wallet.id,
                  address: review.wallet.address,
                  role: hasLifiLeg ? "Source · LI.FI" : "Signing wallet",
                },
                ...legs
                  .filter((l) => l.walletId !== review.wallet.id)
                  .map((l) => ({
                    id: l.walletId,
                    address:
                      review.wallets?.[l.walletId]?.address ??
                      `wallet:${l.walletId.slice(0, 8)}`,
                    role:
                      l.kind === "lend" || l.kind === "approve"
                        ? "Lend"
                        : l.kind === "swap" || l.kind === "bridge"
                          ? "LI.FI"
                          : l.kind,
                  })),
              ]
                .filter(
                  (w, i, arr) => arr.findIndex((x) => x.id === w.id) === i,
                )
                .map((w) => (
                  <li
                    key={w.id}
                    className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-400"
                  >
                    <Wallet className="size-3 shrink-0 text-zinc-600" />
                    <span className="font-mono text-zinc-200">
                      {shortAddr(w.address)}
                    </span>
                    <span className="text-zinc-600">· {w.role}</span>
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              What needs a signature · what ran
            </p>
            <ol className="space-y-2">
              {legs.map((leg, i) => {
                const done = status === "done" || i < activeStep;
                const active = i === activeStep && busy;
                const stepTx = stepTxs[i];
                return (
                <li
                  key={`${leg.stepIndex}-${leg.kind}`}
                  className={
                    active
                      ? "rounded-lg border border-sky-800/60 bg-sky-950/20 px-3 py-2"
                      : "rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2"
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                        {i + 1}. {leg.kind}
                      </p>
                      <p className="text-sm text-zinc-100">{leg.label}</p>
                      {stepTx?.txHash && (
                        <p className="mt-1 font-mono text-[11px] text-zinc-500 break-all">
                          {shortAddr(stepTx.txHash)}
                          {stepTx.explorerUrl && (
                            <>
                              {" · "}
                              <a
                                href={stepTx.explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-sky-400 hover:text-sky-300"
                              >
                                Explorer
                                <ExternalLink className="size-2.5" />
                              </a>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    {done && (
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
                        Done
                      </span>
                    )}
                    {active && (
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-sky-400">
                        Signing
                      </span>
                    )}
                  </div>
                </li>
                );
              })}
            </ol>
          </div>
        </>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs font-mono">
        <dt className="text-zinc-500">Primary wallet</dt>
        <dd className="text-zinc-300 break-all">
          {shortAddr(review.wallet.address)}
        </dd>
        <dt className="text-zinc-500">Steps</dt>
        <dd className="text-zinc-300">{legs.length}</dd>
        <dt className="text-zinc-500">Route</dt>
        <dd className="text-zinc-300">
          {cross ? `${fromChain} → ${toChain}` : String(fromChain)}
        </dd>
        {hasLifiLeg && (
          <>
            <dt className="text-zinc-500">Via</dt>
            <dd className="text-zinc-300">LI.FI</dd>
            <dt className="text-zinc-500">Min out</dt>
            <dd className="text-zinc-300">{q.minBuyAmount}</dd>
          </>
        )}
        {eta != null && eta > 0 && !settled && needsLifiBridgeWatch && (
          <>
            <dt className="text-zinc-500">ETA</dt>
            <dd className="text-zinc-300">~{eta}s</dd>
          </>
        )}
        {!settled && (
          <>
            <dt className="text-zinc-500">Expires</dt>
            <dd
              className={
                expiry.expired
                  ? "font-medium text-red-400"
                  : expiry.remainingMs < 60_000
                    ? "font-medium text-amber-400"
                    : "text-zinc-300"
              }
            >
              {expiry.expired ? (
                "Expired"
              ) : (
                <span className="tabular-nums">{expiry.label}</span>
              )}
            </dd>
          </>
        )}
        {(status === "done" || status === "waiting_bridge") &&
          needsLifiBridgeWatch && (
          <>
            <dt className="text-zinc-500">Source tx</dt>
            <dd className="text-zinc-300 break-all">{txHash ?? "—"}</dd>
            <dt className="text-zinc-500">LI.FI</dt>
            <dd
              className={
                lifiStatus === "DONE"
                  ? "text-emerald-400"
                  : lifiStatus === "FAILED" || lifiStatus === "REFUNDED"
                    ? "text-red-400"
                    : "text-amber-400"
              }
            >
              <span className="inline-flex items-center gap-1.5">
                {lifiWaiting &&
                  (status === "done" || status === "waiting_bridge") && (
                    <Loader2 className="size-3 animate-spin" />
                  )}
                {labelForLifiStatus(lifiStatus)}
              </span>
            </dd>
            {receivingTxHash && (
              <>
                <dt className="text-zinc-500">Dest tx</dt>
                <dd className="text-zinc-300 break-all">{receivingTxHash}</dd>
              </>
            )}
          </>
        )}
        {status === "done" && !needsLifiBridgeWatch && (
          <>
            <dt className="text-zinc-500">Status</dt>
            <dd className="text-emerald-400">Confirmed on-chain</dd>
          </>
        )}
        {status === "rejected" && (
          <>
            <dt className="text-zinc-500">Status</dt>
            <dd className="text-zinc-400">Rejected — not sent</dd>
          </>
        )}
      </dl>

      {stepNotes.length > 0 && (
        <ul className="space-y-0.5 text-[11px] text-zinc-500">
          {stepNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {status === "done" && explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300"
        >
          {needsLifiBridgeWatch ? "View source tx" : "View explorer"}
          <ExternalLink className="size-3" />
        </a>
      )}

      {!actionsLocked && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-white disabled:opacity-40"
          >
            {busy && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            {status === "signing"
              ? `Sign step ${activeStep + 1}/${legs.length}…`
              : status === "waiting_bridge"
                ? "Waiting for bridge…"
                : status === "confirming"
                  ? "Confirming…"
                  : legs.length > 1
                    ? `Confirm & sign ${legs.length} steps`
                    : "Confirm & sign"}
          </button>
        </div>
      )}
      {expiry.expired && !settled && status === "idle" && (
        <p className="text-xs text-red-400">
          Plan expired — request a new quote to continue.
        </p>
      )}
      {alreadySubmitted && (
        <p className="text-xs text-emerald-400/90">
          Already submitted — see transfer status in chat.
        </p>
      )}
    </div>
  );
}
