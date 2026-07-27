"use client";

import { Check } from "lucide-react";

type DemoPlan = {
  plan?: { summary?: string };
  quote?: {
    displayRoute?: string;
    toolName?: string;
    tool?: string;
    chainId?: number;
    toChainId?: number;
    isCrossChain?: boolean;
    executionDurationSec?: number;
    toAmount?: string;
  };
  wallet?: { address?: string };
};

const CHAIN: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
  1151111081099710: "Solana",
};

export function DemoPlanCard({ review }: { review: DemoPlan }) {
  const q = review.quote ?? {};
  const from = q.chainId != null ? CHAIN[q.chainId] ?? String(q.chainId) : " - ";
  const to =
    q.toChainId != null ? CHAIN[q.toChainId] ?? String(q.toChainId) : from;
  const cross = q.isCrossChain ?? q.chainId !== q.toChainId;
  const route = review.plan?.summary ?? q.displayRoute ?? "Transaction plan";
  const tool = q.toolName ?? q.tool ?? "LI.FI";
  const addr = review.wallet?.address;
  const short = addr
    ? `${addr.slice(0, 6)}…${addr.slice(-4)}`
    : "Trading wallet";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Transaction review
        </p>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
          <Check className="size-3" />
          Confirmed
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-zinc-100">{route}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-zinc-600">Route</dt>
          <dd className="text-zinc-300">{q.displayRoute ?? " - "}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Tool</dt>
          <dd className="text-zinc-300">{tool}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">{cross ? "Chains" : "Chain"}</dt>
          <dd className="text-zinc-300">
            {cross ? `${from} → ${to}` : from}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600">Wallet</dt>
          <dd className="font-mono text-zinc-300">{short}</dd>
        </div>
        {q.executionDurationSec != null && (
          <div>
            <dt className="text-zinc-600">ETA</dt>
            <dd className="text-zinc-300">~{q.executionDurationSec}s</dd>
          </div>
        )}
        {q.toAmount != null && (
          <div>
            <dt className="text-zinc-600">Est. out</dt>
            <dd className="text-zinc-300">{q.toAmount}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
