"use client";

import { Bot, CircleDot } from "lucide-react";
import { getDemoAgent, type DemoAgentActivity } from "@/lib/demo/fixtures";
import { PriceChart } from "./sparkline";

function statusTone(status: DemoAgentActivity["status"] | DemoAgent["status"]) {
  switch (status) {
    case "active":
    case "running":
      return "bg-sky-500/15 text-sky-300";
    case "done":
    case "completed":
      return "bg-emerald-500/15 text-emerald-300";
    case "scheduled":
      return "bg-amber-500/15 text-amber-300";
    case "skipped":
    case "paused":
      return "bg-zinc-500/20 text-zinc-400";
    default:
      return "bg-zinc-500/20 text-zinc-400";
  }
}

type DemoAgent = NonNullable<ReturnType<typeof getDemoAgent>>;

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

export function AgentPanel({ agentId }: { agentId: string }) {
  const agent = getDemoAgent(agentId);
  if (!agent) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Agent not found.
      </div>
    );
  }

  const bias = agent.signal?.bias;
  const biasClass =
    bias === "short"
      ? "text-red-300"
      : bias === "long"
        ? "text-emerald-300"
        : "text-zinc-300";

  return (
    <div className="cipher-scroll h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-8">
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
                {agent.title}
              </h1>
              <p className="mt-1 max-w-xl text-sm text-zinc-500">
                {agent.brief}
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${statusTone(agent.status)}`}
          >
            <CircleDot className="size-3" />
            {agent.status}
          </span>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
            What you asked
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-200">
            {agent.askedTo}
          </p>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
            Configuration
          </p>
          <dl className="grid gap-3 sm:grid-cols-2">
            {agent.params.map((p) => (
              <div key={p.label}>
                <dt className="text-xs text-zinc-600">{p.label}</dt>
                <dd className="text-sm text-zinc-100">{p.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {agent.kind === "ta" && agent.series && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                  Chart
                </p>
                <p className="text-sm text-zinc-300">HYPE · daily closes</p>
              </div>
              {agent.signal && (
                <p className={`text-sm font-medium ${biasClass}`}>
                  Bias: {agent.signal.bias}
                </p>
              )}
            </div>
            <PriceChart series={agent.series} />
            {agent.signal && (
              <div className="mt-4 border-t border-zinc-800 pt-4">
                <p className="text-sm text-zinc-200">{agent.signal.headline}</p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {agent.signal.levels.map((l) => (
                    <li
                      key={l.label}
                      className="flex justify-between gap-2 text-xs"
                    >
                      <span className="text-zinc-600">{l.label}</span>
                      <span className="font-mono text-zinc-300">{l.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
            Run activity
          </p>
          <ul className="space-y-3">
            {agent.activity.map((a) => (
              <li
                key={a.id}
                className="flex gap-3 border-b border-zinc-800/80 pb-3 last:border-0 last:pb-0"
              >
                <span
                  className={`mt-0.5 h-fit shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusTone(a.status)}`}
                >
                  {a.status}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm text-zinc-100">{a.title}</p>
                    <p className="text-[11px] text-zinc-600">
                      {formatAt(a.at)}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">{a.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
