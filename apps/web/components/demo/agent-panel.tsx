"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bot,
  CircleDot,
  MessageSquare,
  Settings2,
  Wallet,
} from "lucide-react";
import { getDemoAgent, type DemoAgentActivity } from "@/lib/demo/fixtures";

function statusTone(
  status: DemoAgentActivity["status"] | "active" | "paused" | "completed",
) {
  switch (status) {
    case "active":
    case "running":
      return "bg-sky-500/15 text-sky-300 border-sky-500/20";
    case "done":
    case "completed":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/20";
    case "scheduled":
      return "bg-amber-500/15 text-amber-300 border-amber-500/20";
    case "skipped":
    case "paused":
      return "bg-zinc-500/20 text-zinc-400 border-zinc-700";
    default:
      return "bg-zinc-500/20 text-zinc-400 border-zinc-700";
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
  const [draftRails, setDraftRails] = useState(() => agent?.guardRails ?? []);
  const [savedFlash, setSavedFlash] = useState(false);

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
            <div className="mt-0.5 rounded-xl border border-violet-500/25 bg-violet-500/10 p-2.5">
              <Bot className="size-5 text-violet-300" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Agent
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
                {agent.title}
              </h1>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${statusTone(agent.status)}`}
          >
            <CircleDot className="size-3" />
            {agent.status}
          </span>
        </header>

        <section className="rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-zinc-950 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-sky-400/80">
            Goal
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-100">
            {agent.askedTo}
          </p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-zinc-950 p-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-emerald-400/80">
              Agent wallet
            </p>
            <div className="flex items-start gap-2">
              <Wallet className="mt-0.5 size-4 text-emerald-400/70" />
              <div>
                <p className="text-sm text-zinc-100">{agent.agentWallet.label}</p>
                <p className="font-mono text-xs text-zinc-400">
                  {shortAddr(agent.agentWallet.address)}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {agent.agentWallet.chainFamily === "solana" ? "Solana" : "EVM"}{" "}
                  · dedicated to this agent
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-zinc-950 p-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-amber-400/80">
              Built from chat
            </p>
            <p className="text-xs leading-relaxed text-zinc-400">
              Instructions and updates live in the chat that created this agent.
            </p>
            <Link
              href={`/c/${agent.chatId}`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-100 transition-colors hover:border-amber-400/40 hover:bg-amber-500/15"
            >
              <MessageSquare className="size-3.5" />
              Open setup chat
            </Link>
          </section>
        </div>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Settings2 className="size-4 text-zinc-400" />
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Configure
              </p>
            </div>
            {savedFlash && (
              <span className="text-[11px] text-emerald-400">Saved</span>
            )}
          </div>
          <p className="mb-4 text-xs text-zinc-500">
            Constraints for any agent. Edit here or change them in chat.
          </p>
          <div className="space-y-3">
            {draftRails.map((rail, idx) => (
              <label key={rail.label} className="block space-y-1">
                <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                  {rail.label}
                </span>
                <input
                  value={rail.value}
                  onChange={(e) => {
                    const next = [...draftRails];
                    next[idx] = { ...rail, value: e.target.value };
                    setDraftRails(next);
                  }}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-0 transition focus:border-violet-500/40"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <p className="mr-auto text-[11px] text-zinc-600">
              Networks: {agent.allowedChains.join(", ")}
            </p>
            <button
              type="button"
              onClick={() => {
                setSavedFlash(true);
                window.setTimeout(() => setSavedFlash(false), 1200);
              }}
              className="rounded-lg border border-violet-500/30 bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-100 transition hover:bg-violet-500/25"
            >
              Save changes
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Activity
          </p>
          <ul className="space-y-3">
            {agent.activity.map((a) => (
              <li
                key={a.id}
                className="flex gap-3 border-b border-zinc-800/80 pb-3 last:border-0 last:pb-0"
              >
                <span
                  className={`mt-0.5 h-fit shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusTone(a.status)}`}
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
