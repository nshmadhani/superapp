"use client";

import { Check, Wallet } from "lucide-react";

export type MultiStepLeg = {
  id: string;
  action: "swap" | "bridge" | "lend" | "deposit";
  title: string;
  detail: string;
  walletLabel: string;
  walletAddress: string;
  chainLabel: string;
  /** Already executed in this product view */
  txHash?: string;
};

export type MultiStepPlan = {
  type: "multi_step_plan";
  summary: string;
  walletsUsed: Array<{ label: string; address: string; role: string }>;
  legs: MultiStepLeg[];
};

function shortAddr(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function DemoMultiStepCard({ plan }: { plan: MultiStepPlan }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-zinc-100">Plan executed</h3>
        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
          <Check className="size-3.5" />
          Complete
        </span>
      </div>
      <p className="text-sm text-zinc-200">{plan.summary}</p>

      <div>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Wallets used
        </p>
        <ul className="space-y-1">
          {plan.walletsUsed.map((w) => (
            <li
              key={w.address}
              className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-400"
            >
              <Wallet className="size-3 shrink-0 text-zinc-600" />
              <span className="text-zinc-200">{w.label}</span>
              <span className="font-mono">{shortAddr(w.address)}</span>
              <span className="text-zinc-600">· {w.role}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          What needed a signature · what ran
        </p>
        <ol className="space-y-2">
          {plan.legs.map((leg, i) => (
            <li
              key={leg.id}
              className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                    {i + 1}. {leg.action}
                  </p>
                  <p className="text-sm text-zinc-100">{leg.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{leg.detail}</p>
                </div>
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
                  Done
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs font-mono">
                <dt className="text-zinc-500">Wallet</dt>
                <dd className="text-zinc-300">
                  {leg.walletLabel} · {shortAddr(leg.walletAddress)}
                </dd>
                <dt className="text-zinc-500">Chain</dt>
                <dd className="text-zinc-300">{leg.chainLabel}</dd>
                {leg.txHash && (
                  <>
                    <dt className="text-zinc-500">Tx</dt>
                    <dd className="break-all text-zinc-400">
                      {shortAddr(leg.txHash)}
                    </dd>
                  </>
                )}
              </dl>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
