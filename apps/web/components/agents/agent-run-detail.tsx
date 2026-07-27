"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bot,
  CircleDot,
  Loader2,
  MessageSquare,
  Wallet,
} from "lucide-react";
import type {
  AgentRun,
  DaoArtifact,
  DcaArtifact,
  TaArtifact,
} from "@cipher/agent-jobs";
import { PriceChart } from "./price-chart";

function statusTone(status: string) {
  if (status === "succeeded" || status === "done")
    return "bg-emerald-500/15 text-emerald-300";
  if (status === "failed" || status === "cancelled" || status === "error")
    return "bg-red-500/15 text-red-300";
  if (status === "running" || status === "queued" || status === "needs_confirm")
    return "bg-sky-500/15 text-sky-300";
  return "bg-zinc-500/20 text-zinc-400";
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatAt(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function agentKindTitle(type: AgentRun["type"]) {
  if (type === "dca") return "DCA";
  if (type === "ta") return "Technical analysis";
  if (type === "dao_research") return "DAO research";
  return type;
}

function guardRailsFromRun(run: AgentRun): Array<{ label: string; value: string }> {
  const p = run.policy ?? {};
  if (run.type === "dca") {
    return [
      {
        label: "Buy size",
        value: `$${Number(p.amountUsd ?? 50)} / ${String(p.cadence ?? "weekly")}`,
      },
      { label: "Asset", value: String(p.asset ?? "ETH") },
      { label: "Mode", value: "One-shot schedule (confirm before live buys)" },
    ];
  }
  if (run.type === "ta") {
    return [
      { label: "Symbol", value: String(p.symbol ?? "ETH") },
      { label: "Interval", value: String(p.interval ?? "1d") },
      { label: "Mode", value: "Read-only analysis · no orders" },
    ];
  }
  return [
    { label: "Topic", value: String(p.topic ?? run.goal) },
    { label: "Mode", value: "Research brief · citations required" },
  ];
}

export function AgentRunDetail({ runId }: { runId: string }) {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/agents/${runId}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "not_found");
      return;
    }
    setRun(data.run as AgentRun);
    setError(null);
  }, [runId]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 1500);
    return () => clearInterval(t);
  }, [refresh]);

  const running =
    run?.status === "queued" ||
    run?.status === "running" ||
    run?.status === "needs_confirm";

  const rails = useMemo(
    () => (run ? guardRailsFromRun(run) : []),
    [run],
  );

  return (
    <div className="cipher-scroll h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-8">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"
        >
          <ArrowLeft className="size-3.5" />
          All agents
        </Link>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {!run && !error && (
          <p className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        )}

        {run && (
          <>
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-2.5">
                  <Bot className="size-5 text-zinc-200" />
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                    Autonomous agent
                  </p>
                  <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
                    {agentKindTitle(run.type)}
                  </h1>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
                >
                  <MessageSquare className="size-3.5" />
                  Open chat
                </Link>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${statusTone(run.status)}`}
                >
                  {running ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <CircleDot className="size-3" />
                  )}
                  {run.status}
                </span>
              </div>
            </header>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                What you asked
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-200">
                {run.goal}
              </p>
            </section>

            {run.wallet && (
              <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                  Agent wallet
                </p>
                <div className="flex items-start gap-2">
                  <Wallet className="mt-0.5 size-4 text-zinc-500" />
                  <div>
                    <p className="text-sm text-zinc-100">{run.wallet.label}</p>
                    <p className="font-mono text-xs text-zinc-500">
                      {shortAddr(run.wallet.address)} ·{" "}
                      {run.wallet.chainFamily === "solana" ? "Solana" : "EVM"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      Dedicated wallet for this agent — buys and lends run from
                      here.
                    </p>
                  </div>
                </div>
              </section>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                  Guard rails
                </p>
                <dl className="space-y-2">
                  {rails.map((r) => (
                    <div key={r.label}>
                      <dt className="text-xs text-zinc-600">{r.label}</dt>
                      <dd className="text-sm text-zinc-100">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                  Allowed chains
                </p>
                <ul className="flex flex-wrap gap-2">
                  {(run.type === "dca"
                    ? ["Base", "Ethereum"]
                    : run.type === "ta"
                      ? ["Binance public · spot"]
                      : ["Open web"]
                  ).map((c) => (
                    <li
                      key={c}
                      className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-300"
                    >
                      {c}
                    </li>
                  ))}
                </ul>
                {run.source && (
                  <p className="mt-3 text-xs text-zinc-600">
                    Result source: {run.source}
                    {run.sandboxId
                      ? ` · e2b ${run.sandboxId.slice(0, 8)}`
                      : ""}
                  </p>
                )}
              </section>
            </div>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                Activity
              </p>
              {run.steps.length === 0 ? (
                <p className="text-sm text-zinc-500">Waiting for worker…</p>
              ) : (
                <ul className="space-y-3">
                  {run.steps.map((s) => (
                    <li
                      key={s.id}
                      className="flex gap-3 border-b border-zinc-800/80 pb-3 last:border-0 last:pb-0"
                    >
                      <span
                        className={`mt-0.5 h-fit shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusTone(s.status)}`}
                      >
                        {s.status}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm text-zinc-100">{s.label}</p>
                          <p className="text-[11px] text-zinc-600">
                            {formatAt(s.at)}
                          </p>
                        </div>
                        {s.detail && (
                          <p className="mt-0.5 break-all text-xs text-zinc-500">
                            {s.detail}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {run.artifact && <ArtifactView artifact={run.artifact} />}
            {run.error && (
              <p className="text-sm text-red-400">Error: {run.error}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ArtifactView({
  artifact,
}: {
  artifact: DcaArtifact | TaArtifact | DaoArtifact;
}) {
  if (artifact.kind === "dca") return <DcaView a={artifact} />;
  if (artifact.kind === "ta") return <TaView a={artifact} />;
  return <DaoView a={artifact} />;
}

function DcaView({ a }: { a: DcaArtifact }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
      <h2 className="text-sm font-medium text-zinc-100">DCA schedule</h2>
      <p className="text-sm text-zinc-400">{a.summary}</p>
      <p className="text-xs text-zinc-500">
        {a.amountUsd} USD · {a.asset} · {a.cadence} · next {a.nextRunAt}
        {a.walletAddress
          ? ` · wallet ${shortAddr(a.walletAddress)}`
          : ""}
      </p>
      <ul className="space-y-1 text-sm text-zinc-300">
        {a.legs.map((leg) => (
          <li
            key={leg.date}
            className="flex justify-between border-t border-zinc-800/80 py-1.5"
          >
            <span>{leg.date}</span>
            <span>${leg.amountUsd}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TaView({ a }: { a: TaArtifact }) {
  const closes = a.series.map((p) => p.c);
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">
            Technical analysis · {a.symbol}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">{a.summary}</p>
        </div>
        <span
          className={
            a.bias === "long"
              ? "rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-medium uppercase text-emerald-400"
              : a.bias === "short"
                ? "rounded-md bg-red-500/15 px-2 py-1 text-xs font-medium uppercase text-red-400"
                : "rounded-md bg-zinc-800 px-2 py-1 text-xs font-medium uppercase text-zinc-400"
          }
        >
          {a.bias}
        </span>
      </div>
      <PriceChart series={closes} />
      <dl className="grid grid-cols-2 gap-2 text-xs text-zinc-500 sm:grid-cols-4">
        <div>
          <dt>RSI14</dt>
          <dd className="text-zinc-200">
            {a.indicators.rsi14?.toFixed(1) ?? "—"}
          </dd>
        </div>
        <div>
          <dt>SMA20</dt>
          <dd className="text-zinc-200">
            {a.indicators.sma20?.toFixed(2) ?? "—"}
          </dd>
        </div>
        <div>
          <dt>SMA50</dt>
          <dd className="text-zinc-200">
            {a.indicators.sma50?.toFixed(2) ?? "—"}
          </dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd className="text-zinc-200">
            {(a.confidence * 100).toFixed(0)}%
          </dd>
        </div>
      </dl>
    </section>
  );
}

function DaoView({ a }: { a: DaoArtifact }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
      <h2 className="text-sm font-medium text-zinc-100">
        DAO research · {a.topic}
      </h2>
      <p className="text-sm text-zinc-400">{a.summary}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
        {a.bullets.map((b) => (
          <li key={b.slice(0, 40)}>{b}</li>
        ))}
      </ul>
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-zinc-600">Sources</p>
        {a.citations.map((c) => (
          <a
            key={c.url}
            href={c.url}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-xs text-sky-400 hover:underline"
          >
            {c.title}
          </a>
        ))}
      </div>
    </section>
  );
}
