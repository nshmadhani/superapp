"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import type {
  AgentRun,
  DaoArtifact,
  DcaArtifact,
  TaArtifact,
} from "@cipher/agent-jobs";

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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8">
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
          <header className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-zinc-100">{run.goal}</h1>
              {running && (
                <Loader2 className="size-4 animate-spin text-sky-400" />
              )}
            </div>
            <p className="text-xs uppercase tracking-wide text-zinc-600">
              {run.type.replace("_", " ")} · {run.status}
              {run.source ? ` · ${run.source}` : ""}
              {run.sandboxId ? ` · e2b ${run.sandboxId.slice(0, 8)}` : ""}
            </p>
            {run.wallet && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs">
                <p className="uppercase tracking-wide text-zinc-600">
                  Agent wallet
                </p>
                <p className="mt-0.5 text-zinc-200">{run.wallet.label}</p>
                <p className="mt-0.5 break-all font-mono text-zinc-400">
                  {run.wallet.address}
                </p>
              </div>
            )}
          </header>

          <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-600">
              Steps
            </h2>
            <ul className="space-y-2">
              {run.steps.map((s) => (
                <li key={s.id} className="flex gap-2 text-sm text-zinc-400">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-zinc-600" />
                  <div>
                    <p className="text-zinc-300">
                      {s.label}{" "}
                      <span className="text-zinc-600">({s.status})</span>
                    </p>
                    {s.detail && (
                      <p className="text-xs text-zinc-600">{s.detail}</p>
                    )}
                  </div>
                </li>
              ))}
              {!run.steps.length && (
                <li className="text-sm text-zinc-500">Waiting for worker…</li>
              )}
            </ul>
          </section>

          {run.artifact && <ArtifactView artifact={run.artifact} />}
          {run.error && (
            <p className="text-sm text-red-400">Error: {run.error}</p>
          )}
        </>
      )}
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
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
      <h2 className="text-sm font-medium text-zinc-100">DCA schedule</h2>
      <p className="text-sm text-zinc-400">{a.summary}</p>
      <p className="text-xs text-zinc-500">
        {a.amountUsd} USD · {a.asset} · {a.cadence} · next {a.nextRunAt}
        {a.walletAddress
          ? ` · wallet ${a.walletAddress.slice(0, 6)}…${a.walletAddress.slice(-4)}`
          : ""}
      </p>
      <ul className="space-y-1 text-sm text-zinc-300">
        {a.legs.map((leg) => (
          <li key={leg.date} className="flex justify-between border-t border-zinc-800/80 py-1.5">
            <span>{leg.date}</span>
            <span>${leg.amountUsd}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TaView({ a }: { a: TaArtifact }) {
  const path = useMemo(() => buildSparkPath(a.series), [a.series]);
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
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
      <svg viewBox="0 0 240 64" className="h-20 w-full text-sky-400">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
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
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
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

function buildSparkPath(series: Array<{ t: number; c: number }>): string {
  if (!series.length) return "";
  const cs = series.map((p) => p.c);
  const min = Math.min(...cs);
  const max = Math.max(...cs);
  const span = max - min || 1;
  return series
    .map((p, i) => {
      const x = (i / Math.max(series.length - 1, 1)) * 240;
      const y = 56 - ((p.c - min) / span) * 48;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
