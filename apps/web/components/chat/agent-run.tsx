"use client";

import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { useState } from "react";
import type { AgentStep } from "./tool-extractors";
import { humanToolState, toolMeta } from "./tool-meta";

function statusIcon(kind: ReturnType<typeof humanToolState>) {
  if (kind === "done") return <Check className="size-3.5 text-emerald-400" />;
  if (kind === "error") return <X className="size-3.5 text-red-400" />;
  if (kind === "running")
    return <Loader2 className="size-3.5 animate-spin text-sky-400" />;
  return <span className="size-3.5 rounded-full border border-zinc-600" />;
}

export function AgentRunView({
  steps,
  running,
}: {
  steps: AgentStep[];
  running?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!steps.length && !running) return null;

  const done = steps.filter((s) => humanToolState(s.state) === "done").length;
  const total = steps.length;
  const active = steps.find((s) => humanToolState(s.state) === "running");
  const label = active
    ? toolMeta(active.toolName).verb
    : running && !steps.length
      ? "Starting agent…"
      : `${done}/${total} tools`;

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-400 hover:text-zinc-200"
      >
        {running || active ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-sky-400" />
        ) : (
          <Check className="size-3.5 shrink-0 text-emerald-400" />
        )}
        <span className="flex-1 font-medium tracking-wide">{label}</span>
        <span className="text-[10px] uppercase tracking-wider text-zinc-600">
          Agent
        </span>
        <ChevronDown
          className={`size-3.5 text-zinc-600 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul className="space-y-1 border-t border-zinc-800/80 px-3 py-2">
          {steps.map((s) => {
            const meta = toolMeta(s.toolName);
            const kind = humanToolState(s.state);
            return (
              <li
                key={s.key}
                className="flex items-start gap-2 py-1 text-xs text-zinc-400"
              >
                {statusIcon(kind)}
                <div className="min-w-0 flex-1">
                  <p className="text-zinc-300">{meta.label}</p>
                  <p className="text-[11px] text-zinc-600">{meta.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
