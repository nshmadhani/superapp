"use client";

import Link from "next/link";
import { Fragment } from "react";
import { Bot, ExternalLink } from "lucide-react";
import type {
  Clarification,
  SearchHit,
  SpawnedAgent,
} from "./tool-extractors";

export function SpawnAgentCard({ run }: { run: SpawnedAgent }) {
  const walletAddr =
    run.wallet && typeof run.wallet === "object" && "address" in run.wallet
      ? String((run.wallet as { address?: string }).address ?? "")
      : "";
  const walletLabel =
    run.wallet && typeof run.wallet === "object" && "label" in run.wallet
      ? String((run.wallet as { label?: string }).label ?? "")
      : "";

  async function copyAddress() {
    if (!walletAddr) return;
    try {
      await navigator.clipboard.writeText(walletAddr);
    } catch {
      // ignore
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        <Bot className="size-3.5" />
        Autonomous agent
      </p>
      {run.goal && (
        <p className="mb-1 text-sm text-zinc-200 line-clamp-2">{run.goal}</p>
      )}
      <p className="text-xs text-zinc-500">
        {String(run.type || "agent").replace("_", " ")} · {run.status}
      </p>
      {walletAddr ? (
        <div className="mt-2 space-y-1">
          {run.needsFunding !== false && (
            <p className="text-[11px] font-medium uppercase tracking-wide text-amber-400/90">
              Needs funding
            </p>
          )}
          <p className="text-xs text-zinc-500">
            {walletLabel || "Ephemeral wallet"}
          </p>
          <p
            className="break-all font-mono text-[11px] text-zinc-300"
            title={walletAddr}
          >
            {walletAddr}
          </p>
          <button
            type="button"
            onClick={() => void copyAddress()}
            className="text-[11px] text-sky-400 hover:underline"
          >
            Copy address
          </button>
        </div>
      ) : (
        <p className="mt-1 text-xs text-zinc-600">No wallet (research / monitor)</p>
      )}
      <Link
        href={run.href}
        className="mt-2 inline-flex text-xs text-sky-400 hover:underline"
      >
        Monitor / stop in Agents →
      </Link>
    </div>
  );
}

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
    via?: string;
    fromChainId: number;
    toChainId: number;
    isCrossChain?: boolean;
    success?: boolean;
    completedAllSteps?: boolean;
    lifiStatus?: string;
    substatus?: string;
    failReason?: string | null;
    receivingChainId?: number | null;
    steps?: Array<{
      kind: string;
      label: string;
      txHash: string;
      explorerUrl?: string;
    }>;
    lifi?: {
      type?: string;
      status?: string;
      terminalKind?: string;
      failReason?: string | null;
      receivingChainId?: number | null;
      guidance?: string;
      lifiExplorerLink?: string | null;
    };
  };
}) {
  const lifi = payload.lifi;
  const via = payload.via ?? (lifi ? "LI.FI" : undefined);
  const status = lifi?.status ?? payload.lifiStatus;
  const failReason = lifi?.failReason ?? payload.failReason;
  const receivingChainId = lifi?.receivingChainId ?? payload.receivingChainId;
  const failed =
    payload.success === false ||
    (Boolean(lifi) &&
      (lifi?.terminalKind === "refunded" ||
        lifi?.terminalKind === "failed" ||
        status === "REFUNDED" ||
        status === "FAILED" ||
        status === "INVALID"));
  const successCopy = lifi
    ? payload.isCrossChain
      ? "LI.FI bridge settled."
      : "LI.FI swap submitted."
    : "Transactions confirmed on-chain.";
  return (
    <div
      className={
        failed
          ? "rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-3 space-y-2"
          : "rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-3 space-y-2"
      }
    >
      <p
        className={
          failed
            ? "text-[11px] font-medium uppercase tracking-wide text-amber-500/90"
            : "text-[11px] font-medium uppercase tracking-wide text-emerald-500/90"
        }
      >
        {lifi ? "lifi_status" : "transfer_submitted"}
      </p>
      <p className="text-sm text-zinc-100">
        {failed
          ? status === "REFUNDED" || lifi?.terminalKind === "refunded"
            ? `Bridge refunded on source${
                failReason ? ` (${failReason})` : ""
              } — destination did not receive funds.`
            : `Transfer did not complete${
                failReason ? ` (${failReason})` : ""
              }.`
          : successCopy}
      </p>
      {lifi?.guidance && (
        <p className="text-xs text-zinc-400">{lifi.guidance}</p>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs font-mono">
        {payload.route && (
          <>
            <dt className="text-zinc-500">Route</dt>
            <dd className="text-zinc-300">{payload.route}</dd>
          </>
        )}
        {via === "LI.FI" && (
          <>
            <dt className="text-zinc-500">Via</dt>
            <dd className="text-zinc-300">LI.FI</dd>
          </>
        )}
        <dt className="text-zinc-500">Chains</dt>
        <dd className="text-zinc-300">
          {payload.fromChainId === payload.toChainId
            ? String(payload.fromChainId)
            : `${payload.fromChainId} → ${payload.toChainId}`}
          {receivingChainId != null ? ` (recv ${receivingChainId})` : ""}
        </dd>
        {status && lifi && (
          <>
            <dt className="text-zinc-500">Status</dt>
            <dd className="text-zinc-300">
              {status}
              {failReason ? ` · ${failReason}` : ""}
              {lifi?.terminalKind ? ` · ${lifi.terminalKind}` : ""}
            </dd>
          </>
        )}
        {payload.steps && payload.steps.length > 0
          ? payload.steps.map((s, i) => (
              <Fragment key={`${s.txHash}-${i}`}>
                <dt className="text-zinc-500">
                  {i + 1}. {s.kind}
                </dt>
                <dd className="text-zinc-300 break-all">
                  {s.explorerUrl ? (
                    <a
                      href={s.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:text-sky-300"
                    >
                      {s.txHash}
                    </a>
                  ) : (
                    s.txHash
                  )}
                </dd>
              </Fragment>
            ))
          : payload.txHash && (
              <>
                <dt className="text-zinc-500">Tx</dt>
                <dd className="text-zinc-300 break-all">{payload.txHash}</dd>
              </>
            )}
      </dl>
      {(lifi?.lifiExplorerLink || payload.explorerUrl) && (
        <a
          href={lifi?.lifiExplorerLink || payload.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300"
        >
          {lifi?.lifiExplorerLink ? "LI.FI scan" : "Explorer"}
          <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}
