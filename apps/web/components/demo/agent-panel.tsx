"use client";

import Link from "next/link";
import { Bot, CircleDot, MessageSquare, Wallet } from "lucide-react";
import { getDemoAgent, type DemoAgentActivity } from "@/lib/demo/fixtures";

function statusTone(status: DemoAgentActivity["status"] | "active" | "paused" | "completed") {
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

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
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
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/c/${agent.chatId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
            >
              <MessageSquare className="size-3.5" />
              Open chat
            </Link>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${statusTone(agent.status)}`}
            >
              <CircleDot className="size-3" />
              {agent.status}
            </span>
          </div>
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
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
            Agent wallet
          </p>
          <div className="flex items-start gap-2">
            <Wallet className="mt-0.5 size-4 text-zinc-500" />
            <div>
              <p className="text-sm text-zinc-100">
                {agent.agentWallet.label}
              </p>
              <p className="font-mono text-xs text-zinc-500">
                {shortAddr(agent.agentWallet.address)} ·{" "}
                {agent.agentWallet.chainFamily === "solana" ? "Solana" : "EVM"}
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Dedicated wallet for this agent — buys run from here.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
              Guard rails
            </p>
            <dl className="space-y-2">
              {agent.guardRails.map((p) => (
                <div key={p.label}>
                  <dt className="text-xs text-zinc-600">{p.label}</dt>
                  <dd className="text-sm text-zinc-100">{p.value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
              Allowed chains
            </p>
            <ul className="flex flex-wrap gap-2">
              {agent.allowedChains.map((c) => (
                <li
                  key={c}
                  className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-300"
                >
                  {c}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
            Activity
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
