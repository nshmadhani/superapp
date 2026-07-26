"use client";

import { Check, Loader2, Wallet } from "lucide-react";

export type MultiStepLeg = {
  id: string;
  action: "swap" | "bridge" | "lend";
  title: string;
  detail: string;
  walletLabel: string;
  walletAddress: string;
  chainLabel: string;
  status: "pending" | "awaiting_signature" | "signing" | "done";
  txHash?: string;
};

export type MultiStepPlan = {
  type: "multi_step_plan";
  summary: string;
  status: "ready" | "executing" | "completed";
  legs: MultiStepLeg[];
};

function actionLabel(a: MultiStepLeg["action"]) {
  switch (a) {
    case "swap":
      return "Swap";
    case "bridge":
      return "Bridge";
    case "lend":
      return "Lend";
  }
}

function StatusPill({ status }: { status: MultiStepLeg["status"] }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
        <Check className="size-3" />
        Signed
      </span>
    );
  }
  if (status === "signing" || status === "awaiting_signature") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-300">
        <Loader2 className="size-3 animate-spin" />
        {status === "signing" ? "Signing" : "Sign"}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-zinc-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
      Pending
    </span>
  );
}

function shortAddr(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function DemoMultiStepCard({ plan }: { plan: MultiStepPlan }) {
  const done = plan.legs.filter((l) => l.status === "done").length;
  const total = plan.legs.length;
  const allDone = plan.status === "completed" || done === total;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Multi-step · multi-wallet
        </p>
        <span
          className={
            allDone
              ? "inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400"
              : "inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-300"
          }
        >
          {allDone ? (
            <>
              <Check className="size-3" />
              {done}/{total} executed
            </>
          ) : (
            <>
              <Loader2 className="size-3 animate-spin" />
              {done}/{total} signed
            </>
          )}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-zinc-100">{plan.summary}</p>
      <p className="mt-1 text-xs text-zinc-500">
        One plan — each leg signs on the wallet that holds that step.
      </p>

      <ol className="mt-4 space-y-3">
        {plan.legs.map((leg, i) => (
          <li
            key={leg.id}
            className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2.5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                  Step {i + 1} · {actionLabel(leg.action)}
                </p>
                <p className="mt-0.5 text-sm text-zinc-100">{leg.title}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{leg.detail}</p>
              </div>
              <StatusPill status={leg.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
              <span className="inline-flex items-center gap-1">
                <Wallet className="size-3" />
                <span className="text-zinc-300">{leg.walletLabel}</span>
                <span className="font-mono">{shortAddr(leg.walletAddress)}</span>
              </span>
              <span>{leg.chainLabel}</span>
              {leg.txHash && (
                <span className="font-mono text-zinc-600">
                  tx {shortAddr(leg.txHash)}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
