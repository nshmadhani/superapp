"use client";

import { useTurnkey } from "@turnkey/react-wallet-kit";
import { Loader2 } from "lucide-react";
import { useState } from "react";

type PlanReview = {
  confirmId: string;
  planId: string;
  planHash: string;
  plan: {
    summary?: string;
    walletId: string;
    steps: unknown[];
    expiresAt: string;
  };
  quote: {
    to: string;
    data: string;
    value: string;
    minBuyAmount: string;
    displayRoute: string;
    chainId: number;
  };
  wallet: { address: string; id: string };
};

type Caip2 =
  | "eip155:1"
  | "eip155:8453"
  | "eip155:11155111"
  | "eip155:84532"
  | "eip155:137"
  | "eip155:80002"
  | "eip155:56"
  | "eip155:97";

function toCaip2(chainId: number): Caip2 | null {
  const map: Record<number, Caip2> = {
    1: "eip155:1",
    8453: "eip155:8453",
    11155111: "eip155:11155111",
    84532: "eip155:84532",
    137: "eip155:137",
    80002: "eip155:80002",
    56: "eip155:56",
    97: "eip155:97",
  };
  return map[chainId] ?? null;
}

export function TxReviewCard({
  review,
  onDismiss,
}: {
  review: PlanReview;
  onDismiss?: () => void;
}) {
  const { handleSendTransaction } = useTurnkey();
  const [status, setStatus] = useState<
    "idle" | "confirming" | "signing" | "done" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [txNote, setTxNote] = useState<string | null>(null);

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

      const caip2 = toCaip2(data.unsignedTx.chainId as number);
      if (!caip2) {
        throw new Error(`Unsupported chainId ${data.unsignedTx.chainId}`);
      }

      setStatus("signing");
      await handleSendTransaction({
        transaction: {
          from: data.walletAddress as string,
          to: data.unsignedTx.to as string,
          data: data.unsignedTx.data as string,
          value: (data.unsignedTx.value as string) || "0",
          caip2,
        },
      });
      setTxNote("Transaction submitted via Turnkey.");
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed");
      setStatus("error");
    }
  }

  const busy = status === "confirming" || status === "signing";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-zinc-100">Transaction review</h3>
        {onDismiss && status !== "done" && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-zinc-500 hover:text-zinc-200"
          >
            Dismiss
          </button>
        )}
      </div>
      <p className="text-sm text-zinc-200">
        {review.plan.summary ?? review.quote.displayRoute}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs font-mono">
        <dt className="text-zinc-500">Wallet</dt>
        <dd className="text-zinc-300 break-all">{review.wallet.address}</dd>
        <dt className="text-zinc-500">Chain</dt>
        <dd className="text-zinc-300">{review.quote.chainId}</dd>
        <dt className="text-zinc-500">To</dt>
        <dd className="truncate text-zinc-300">{review.quote.to}</dd>
        <dt className="text-zinc-500">Min out</dt>
        <dd className="text-zinc-300">{review.quote.minBuyAmount}</dd>
        <dt className="text-zinc-500">Expires</dt>
        <dd className="text-zinc-300">{review.plan.expiresAt}</dd>
      </dl>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {txNote && <p className="text-xs text-emerald-400">{txNote}</p>}

      {status === "done" ? (
        <p className="text-xs text-zinc-500">Confirmed and sent.</p>
      ) : (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-white disabled:opacity-40"
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {status === "signing" ? "Sign in wallet…" : "Confirm & sign"}
          </button>
          <p className="text-[11px] text-zinc-600">
            Approves the plan, then opens Turnkey to sign.
          </p>
        </div>
      )}
    </div>
  );
}
