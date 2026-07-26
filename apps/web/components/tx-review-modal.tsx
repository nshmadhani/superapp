"use client";

import { isLifiSolanaChain } from "@cipher/core";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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
  };
  wallet: { address: string; id: string };
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
    status === "rejecting";

  useEffect(() => {
    if (status !== "done" || !txHash) return;
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
          error?: string;
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
  }, [status, txHash, fromChain, toChain, bridgeTool]);

  async function onConfirm() {
    setError(null);
    setStatus("confirming");
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

      setStatus("signing");
      const unsignedTx =
        data.unsignedTx ??
        utx ??
        (q.data
          ? {
              to: q.to,
              data: q.data,
              value: q.value,
              chainId: q.chainId,
            }
          : undefined);
      const walletAddress = data.walletAddress ?? review.wallet.address;
      const result = await executeLifiAfterConfirm({
        lifiStep: data.lifiStep ?? review.plan.lifiStep,
        unsignedTx,
        walletAddress,
        handleSendTransaction: handleSendTransaction as never,
        signTransaction: signTransaction as never,
        walletAccount: findWalletAccount(wallets ?? [], walletAddress),
        solanaRpcUrl: SOLANA_RPC_URL,
      });

      const hash = result.txHash;
      const url = hash ? explorerUrlForTx(fromChain, hash) : undefined;
      if (hash) setTxHash(hash);
      if (url) setExplorerUrl(url);

      setStatus("done");
      onOutcome?.({
        status: "approved",
        planId: review.planId,
        txHash: hash,
        explorerUrl: url,
        agentPayload: encodeTransferSubmitted({
          planId: review.planId,
          txHash: hash,
          explorerUrl: url,
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
            ? "Transfer submitted"
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
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs font-mono">
        <dt className="text-zinc-500">Wallet</dt>
        <dd className="text-zinc-300 break-all">{review.wallet.address}</dd>
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
        {status === "done" && (
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
                {lifiWaiting && status === "done" && (
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
              ? "Sign in wallet…"
              : status === "confirming"
                ? "Confirming…"
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
