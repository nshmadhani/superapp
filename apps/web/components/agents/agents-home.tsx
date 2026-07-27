"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bot, MessageSquare } from "lucide-react";
import type { AgentRun } from "@cipher/agent-jobs/types";

function statusColor(status: string) {
  if (status === "succeeded") return "text-emerald-400";
  if (status === "failed" || status === "cancelled") return "text-red-400";
  if (status === "running" || status === "queued") return "text-sky-400";
  return "text-zinc-400";
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function artifactLabel(run: AgentRun): string | null {
  const a = run.artifact;
  if (!a) return null;
  if (a.kind === "dca") {
    const n = a.legs.filter((l) => l.txHash).length;
    return n > 0 ? `${n} trade${n === 1 ? "" : "s"}` : "DCA";
  }
  if (a.kind === "ta") return `TA · ${a.bias}`;
  if (a.kind === "dao_research") return "Research brief";
  if (a.kind === "general") {
    return a.citations?.length ? "Research brief" : "Result";
  }
  return null;
}

export function AgentsHome() {
  const [runs, setRuns] = useState<AgentRun[]>([]);

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

  return (
    <div className="cipher-scroll h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-2.5">
            <Bot className="size-5 text-zinc-200" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
              Autonomous agents
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
              Agents
            </h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-500">
              Monitor and stop agents here. Create and fund them in chat — one
              at a time. Open a run to read its research brief, TA, or executed
              trades.
            </p>
            <Link
              href="/app"
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-sky-400 hover:underline"
            >
              <MessageSquare className="size-3.5" />
              Create an agent in chat
            </Link>
          </div>
        </div>

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-600">
            Recent runs
          </h2>
          {runs.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No agent runs yet. Start one from chat.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800">
              {runs.map((r) => {
                const art = artifactLabel(r);
                return (
                  <li key={r.id}>
                    <Link
                      href={`/app/agents/${r.id}`}
                      className="flex items-center justify-between gap-3 px-3 py-3 text-sm hover:bg-zinc-900/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-zinc-200">{r.goal}</p>
                        <p className="text-[11px] uppercase tracking-wide text-zinc-600">
                          {String(r.type).replace("_", " ")}
                          {r.wallet
                            ? ` · ${r.wallet.label} · ${shortAddr(r.wallet.address)}`
                            : " · no wallet"}
                          {art ? ` · ${art}` : ""}
                          {r.source ? ` · ${r.source}` : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs ${statusColor(r.status)}`}
                      >
                        {r.status}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
