"use client";

import { ExternalLink } from "lucide-react";
import { walletDisplayName } from "@/lib/wallet-display";
import type { Clarification, PortfolioSnap, SearchHit } from "./tool-extractors";

export function CitationsCard({ hits }: { hits: SearchHit[] }) {
  if (!hits.length) return null;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        Sources
      </p>
      <ul className="space-y-1.5">
        {hits.slice(0, 5).map((h) => (
          <li key={h.url}>
            <a
              href={h.url}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex max-w-full items-start gap-1.5 text-xs text-zinc-300 hover:text-zinc-100"
            >
              <ExternalLink className="mt-0.5 size-3 shrink-0 text-zinc-600 group-hover:text-zinc-400" />
              <span className="truncate">{h.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PortfolioCard({ snap }: { snap: PortfolioSnap }) {
  const isOverview = snap.type === "portfolio_overview";
  const title = isOverview
    ? "Overview"
    : walletDisplayName({ label: snap.label, source: "turnkey" });
  return (
    <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          {title}
        </p>
        {!isOverview && snap.address && (
          <p className="font-mono text-[11px] text-zinc-600">
            {snap.address.slice(0, 4)}…{snap.address.slice(-4)}
          </p>
        )}
      </div>
      <p className="text-xl font-semibold text-zinc-100">
        $
        {snap.totalValueUsd.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}
      </p>
      {isOverview && snap.wallets && snap.wallets.length > 0 && (
        <ul className="space-y-1 border-b border-zinc-800 pb-2">
          {snap.wallets.map((w) => (
            <li
              key={w.walletId}
              className="flex justify-between gap-2 text-xs text-zinc-400"
            >
              <span className="text-zinc-200">
                {walletDisplayName({ label: w.label })}
              </span>
              <span>
                $
                {w.totalValueUsd.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
      <ul className="space-y-1">
        {snap.positions.slice(0, 8).map((p, i) => (
          <li
            key={`${p.symbol}-${i}`}
            className="flex justify-between gap-2 text-xs text-zinc-400"
          >
            <span>
              <span className="text-zinc-200">{p.symbol}</span>
              {isOverview && p.walletLabel && (
                <span className="ml-1.5 text-zinc-600">
                  · {walletDisplayName({ label: p.walletLabel })}
                </span>
              )}
              <span className="ml-1.5 text-zinc-600">{p.quantity}</span>
            </span>
            <span>
              {p.valueUsd == null
                ? "—"
                : `$${p.valueUsd.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ClarificationCard({
  item,
  onChoose,
}: {
  item: Clarification;
  onChoose?: (option: string) => void;
}) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-amber-500/80">
        Needs your input
      </p>
      <p className="mt-1 text-sm text-zinc-100">{item.question}</p>
      {item.options.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChoose?.(opt)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TransferSubmittedCard({
  payload,
}: {
  payload: {
    planId: string;
    txHash?: string;
    explorerUrl?: string;
    route?: string;
    tool?: string;
    fromChainId: number;
    toChainId: number;
    isCrossChain?: boolean;
  };
}) {
  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-3 space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-500/90">
        transfer_submitted
      </p>
      <p className="text-sm text-zinc-100">
        Source transaction signed and broadcast
        {payload.isCrossChain ? " — LI.FI bridge in progress" : ""}.
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs font-mono">
        {payload.route && (
          <>
            <dt className="text-zinc-500">Route</dt>
            <dd className="text-zinc-300">{payload.route}</dd>
          </>
        )}
        {payload.tool && (
          <>
            <dt className="text-zinc-500">Via</dt>
            <dd className="text-zinc-300">{payload.tool}</dd>
          </>
        )}
        <dt className="text-zinc-500">Chains</dt>
        <dd className="text-zinc-300">
          {payload.fromChainId} → {payload.toChainId}
        </dd>
        {payload.txHash && (
          <>
            <dt className="text-zinc-500">Tx</dt>
            <dd className="text-zinc-300 break-all">{payload.txHash}</dd>
          </>
        )}
      </dl>
      {payload.explorerUrl && (
        <a
          href={payload.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300"
        >
          Explorer
          <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}
