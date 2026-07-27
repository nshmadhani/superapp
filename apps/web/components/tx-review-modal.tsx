"use client";

import { isLifiSolanaChain, type PlanStepExecution } from "@cipher/core";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import { ExternalLink, Loader2, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  executeLifiAfterConfirm,
  findWalletAccount,
} from "@/lib/lifi-execute";
import { encodeTransferSubmitted } from "@/lib/transfer-submitted";

const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

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
      return "Refunded";
    case "INVALID":
      return "Invalid";
    default:
      return s === "idle" ? "—" : String(s);
  }
}

async function waitForLifiDone(opts: {
  txHash: string;
  fromChain: number;
  toChain: number;
  bridgeTool?: string;
  onStatus: (s: LifiUiStatus, receiving?: string) => void;
  timeoutMs?: number;
}): Promise<boolean> {
  const deadline = Date.now() + (opts.timeoutMs ?? 180_000);
  while (Date.now() < deadline) {
    const params = new URLSearchParams({
      txHash: opts.txHash,
      fromChain: String(opts.fromChain),
      toChain: String(opts.toChain),
    });
    if (opts.bridgeTool) params.set("bridge", opts.bridgeTool);
    try {
      const res = await fetch(`/api/lifi/status?${params}`);
      const data = (await res.json()) as {
        status?: string;
        receiving?: { txHash?: string };
      };
      const st = (data.status ?? "unknown") as LifiUiStatus;
      opts.onStatus(st, data.receiving?.txHash);
      if (st === "DONE") return true;
      if (st === "FAILED" || st === "REFUNDED") return false;
    } catch {
      opts.onStatus("unknown");
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  return false;
}

export function TxReviewCard({
  review,
  onDismiss,
  onOutcome,
}: {
  review: PlanReview;
  onDismiss?: () => void;
  onOutcome?: (outcome: TxReviewOutcome) => void;
}) {
  const { handleSendTransaction, signTransaction, wallets } = useTurnkey();
  const [status, setStatus] = useState<
    | "idle"
    | "confirming"
    | "signing"
    | "waiting_bridge"
    | "rejecting"
    | "done"
    | "rejected"
    | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [lifiStatus, setLifiStatus] = useState<LifiUiStatus>("idle");
  const [receivingTxHash, setReceivingTxHash] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [stepNotes, setStepNotes] = useState<string[]>([]);

  const q = review.quote;
  const utx = review.plan.unsignedTx;
  const fromChain = q.chainId;
  const toChain = q.toChainId ?? utx?.toChainId ?? fromChain;
  const cross = q.isCrossChain ?? utx?.isCrossChain ?? fromChain !== toChain;
  const toolName = q.toolName ?? utx?.toolName ?? q.tool ?? "LI.FI";
  const bridgeTool = q.tool ?? utx?.tool;
  const eta = q.executionDurationSec ?? utx?.executionDurationSec;
  const routeLabel = review.plan.summary ?? q.displayRoute;
  const settled = status === "done" || status === "rejected";
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
          toolName,
          isCrossChain: cross,
          minBuyAmount: q.minBuyAmount,
          displayRoute: routeLabel,
          executionDurationSec: eta,
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
    toolName,
    eta,
  ]);

  useEffect(() => {
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
  }, [status, txHash, fromChain, toChain, bridgeTool, legs.length]);

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
    setError(null);
    setStatus("confirming");
    setStepNotes([]);
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

      for (let i = 0; i < confirmedLegs.length; i++) {
        const leg = confirmedLegs[i]!;
        setActiveStep(i);
        setStatus("signing");
        setStepNotes((prev) => [
          ...prev,
          `Signing step ${i + 1}/${confirmedLegs.length}: ${leg.label}`,
        ]);

        const walletAddress = resolveAddress(leg.walletId, confirmedWallets);
        const result = await executeLifiAfterConfirm({
          lifiStep: leg.lifiStep,
          unsignedTx: leg.unsignedTx,
          walletAddress,
          handleSendTransaction: handleSendTransaction as never,
          signTransaction: signTransaction as never,
          walletAccount: findWalletAccount(wallets ?? [], walletAddress),
          solanaRpcUrl: SOLANA_RPC_URL,
        });

        if (i === 0) {
          firstHash = result.txHash;
          firstExplorer = result.txHash
            ? explorerUrlForTx(leg.unsignedTx.chainId, result.txHash)
            : undefined;
          if (firstHash) setTxHash(firstHash);
          if (firstExplorer) setExplorerUrl(firstExplorer);
        }

        if (leg.waitForLifi) {
          if (!result.txHash) {
            throw new Error(
              "Bridge source tx hash missing — cannot wait for LI.FI before lend.",
            );
          }
          setStatus("waiting_bridge");
          setLifiStatus("PENDING");
          const ok = await waitForLifiDone({
            txHash: result.txHash,
            fromChain: leg.unsignedTx.chainId,
            toChain: leg.unsignedTx.toChainId ?? toChain,
            bridgeTool: leg.unsignedTx.tool ?? bridgeTool,
            onStatus: (st, receiving) => {
              setLifiStatus(st);
              if (receiving) setReceivingTxHash(receiving);
            },
          });
          if (!ok) {
            throw new Error("Bridge did not complete — lend steps aborted.");
          }
          setStepNotes((prev) => [...prev, "Bridge settled — continuing."]);
        }
      }

      setStatus("done");
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
          tool: bridgeTool ?? toolName,
          isCrossChain: cross,
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
          {status === "done"
            ? "Plan submitted"
            : status === "rejected"
              ? "Transfer rejected"
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
                  role: "Source · LI.FI",
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
                        ? "Morpho lend"
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
              What needs a signature
            </p>
            <ol className="space-y-2">
              {legs.map((leg, i) => (
                <li
                  key={`${leg.stepIndex}-${leg.kind}`}
                  className={
                    i === activeStep && busy
                      ? "rounded-lg border border-sky-800/60 bg-sky-950/20 px-3 py-2"
                      : "rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2"
                  }
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                    {i + 1}. {leg.kind}
                  </p>
                  <p className="text-sm text-zinc-100">{leg.label}</p>
                </li>
              ))}
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
        <dt className="text-zinc-500">Via</dt>
        <dd className="text-zinc-300">{toolName}</dd>
        <dt className="text-zinc-500">Min out</dt>
        <dd className="text-zinc-300">{q.minBuyAmount}</dd>
        {eta != null && eta > 0 && !settled && (
          <>
            <dt className="text-zinc-500">ETA</dt>
            <dd className="text-zinc-300">~{eta}s</dd>
          </>
        )}
        {!settled && (
          <>
            <dt className="text-zinc-500">Expires</dt>
            <dd className="text-zinc-300">{review.plan.expiresAt}</dd>
          </>
        )}
        {(status === "done" || status === "waiting_bridge") && (
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
          View source tx
          <ExternalLink className="size-3" />
        </a>
      )}

      {!settled && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-white disabled:opacity-40"
          >
            {busy && status !== "rejecting" && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            {status === "signing"
              ? `Sign step ${activeStep + 1}…`
              : status === "waiting_bridge"
                ? "Waiting for bridge…"
                : status === "confirming"
                  ? "Confirming…"
                  : legs.length > 1
                    ? "Confirm & sign all steps"
                    : "Confirm & sign"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onReject()}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-40"
          >
            {status === "rejecting" && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
