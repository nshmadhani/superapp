"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bot, LineChart, Repeat, ScrollText } from "lucide-react";
import type { AgentRun, AgentType } from "@cipher/agent-jobs";

const LAUNCHERS: Array<{
  type: AgentType;
  title: string;
  blurb: string;
  goal: string;
  policy: Record<string, unknown>;
  icon: typeof Bot;
}> = [
  {
    type: "dca",
    title: "DCA agent",
    blurb: "One-shot schedule for recurring buys — no chat babysitting.",
    goal: "DCA $50 of ETH weekly",
    policy: { asset: "ETH", amountUsd: 50, cadence: "weekly" },
    icon: Repeat,
  },
  {
    type: "ta",
    title: "Technical analysis",
    blurb: "Pull public OHLCV, run indicators in E2B, return long/short bias.",
    goal: "Technical analysis on ETH daily — bias for short or long",
    policy: { symbol: "ETH", interval: "1d" },
    icon: LineChart,
  },
  {
    type: "dao_research",
    title: "DAO research",
    blurb: "Autonomous brief on a token/DAO with citations.",
    goal: "Research Uniswap DAO recent governance",
    policy: { topic: "Uniswap DAO governance" },
    icon: ScrollText,
  },
];

function statusColor(status: string) {
  if (status === "succeeded") return "text-emerald-400";
  if (status === "failed" || status === "cancelled") return "text-red-400";
  if (status === "running" || status === "queued") return "text-sky-400";
  return "text-zinc-400";
}

export function AgentsHome() {
  const router = useRouter();
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [busy, setBusy] = useState<AgentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/agents");
    if (!res.ok) return;
    const data = await res.json();
    setRuns(data.runs ?? []);
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 2000);
    return () => clearInterval(t);
  }, [refresh]);

  async function launch(type: AgentType, goal: string, policy: Record<string, unknown>) {
    setBusy(type);
    setError(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, goal, policy }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "create_failed");
      router.push(`/agents/${data.run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start agent");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <Bot className="size-5 text-zinc-400" />
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Agents
          </h1>
        </div>
        <p className="max-w-xl text-sm text-zinc-500">
          One-shot autonomous jobs. They run in E2B sandboxes (live-first, with
          hard fallbacks) — not a chat thread.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        {LAUNCHERS.map((l) => {
          const Icon = l.icon;
          return (
            <button
              key={l.type}
              type="button"
              disabled={busy !== null}
              onClick={() => void launch(l.type, l.goal, l.policy)}
              className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-left transition hover:border-zinc-600 disabled:opacity-60"
            >
              <Icon className="mb-3 size-5 text-zinc-400" />
              <p className="text-sm font-medium text-zinc-100">{l.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                {l.blurb}
              </p>
              <p className="mt-3 text-[11px] uppercase tracking-wide text-zinc-600">
                {busy === l.type ? "Starting…" : "Run once"}
              </p>
            </button>
          );
        })}
      </div>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-600">
          Recent runs
        </h2>
        {runs.length === 0 ? (
          <p className="text-sm text-zinc-500">No agent runs yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800">
            {runs.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/agents/${r.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-3 text-sm hover:bg-zinc-900/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-zinc-200">{r.goal}</p>
                    <p className="text-[11px] uppercase tracking-wide text-zinc-600">
                      {r.type.replace("_", " ")}
                      {r.source ? ` · ${r.source}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs ${statusColor(r.status)}`}>
                    {r.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
