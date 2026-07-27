"use client";

import { useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { Loader2 } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { AgentRunView } from "@/components/chat/agent-run";
import { ChatComposer } from "@/components/chat/chat-composer";
import {
  CitationsCard,
  ClarificationCard,
  PortfolioCard,
} from "@/components/chat/cards";
import {
  extractAgentSteps,
  extractCitations,
  extractClarifications,
  extractPlanReviews,
  extractPortfolios,
  textFromParts,
  toolOutput,
} from "@/components/chat/tool-extractors";
import { DemoPlanCard } from "./demo-plan-card";
import {
  DemoMultiStepCard,
  type MultiStepPlan,
} from "./demo-multi-step-card";
import { DemoTaCard, type TaSnapshot } from "./demo-ta-card";
import { PriceChart } from "./sparkline";
import { getDemoChat } from "@/lib/demo/fixtures";
import { useDemoPlayback } from "@/lib/demo/use-demo-playback";
import { isTaLiveChat, TaLiveSession } from "./ta-live-session";

function extractMultiStepPlans(parts: UIMessage["parts"]): MultiStepPlan[] {
  const out: MultiStepPlan[] = [];
  const seen = new Set<string>();
  for (const part of parts ?? []) {
    const output = toolOutput(part) as MultiStepPlan | undefined;
    if (output?.type === "multi_step_plan" && Array.isArray(output.legs)) {
      const key = output.summary + output.legs.map((l) => l.id).join(",");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(output);
    }
  }
  return out;
}

function extractPriceSeries(parts: UIMessage["parts"]) {
  for (const part of parts ?? []) {
    const output = toolOutput(part) as
      | {
          type?: string;
          symbol?: string;
          timeframe?: string;
          series?: number[];
          last?: number;
          changePct?: number;
        }
      | undefined;
    if (output?.type === "price_series" && Array.isArray(output.series)) {
      return output;
    }
  }
  return null;
}

function extractTaSnapshot(parts: UIMessage["parts"]): TaSnapshot | null {
  for (const part of parts ?? []) {
    const output = toolOutput(part) as TaSnapshot | undefined;
    if (output?.type === "ta_snapshot") return output;
  }
  return null;
}

function DemoMessage({
  message,
  isLastAssistant,
  busy,
  preferAgentOpen,
}: {
  message: UIMessage;
  isLastAssistant?: boolean;
  busy?: boolean;
  preferAgentOpen?: boolean;
}) {
  const steps = extractAgentSteps(message.parts);
  const reviews = extractPlanReviews(message.parts);
  const multiPlans = extractMultiStepPlans(message.parts);
  const citations = extractCitations(message.parts);
  const portfolios = extractPortfolios(message.parts);
  const clarifications = extractClarifications(message.parts);
  const price = extractPriceSeries(message.parts);
  const ta = extractTaSnapshot(message.parts);
  const text = textFromParts(message.parts);
  const showAgent =
    message.role === "assistant" &&
    (steps.length > 0 || (isLastAssistant && busy));

  if (message.role === "user") {
    return (
      <div className="w-full">
        <div className="w-full rounded-2xl bg-zinc-800 px-4 py-3 text-sm text-zinc-50">
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            {text}
            {busy && (
              <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-zinc-400 align-middle" />
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {showAgent && (
        <AgentRunView
          steps={steps}
          running={Boolean(isLastAssistant && busy)}
          preferOpen={preferAgentOpen && isLastAssistant}
        />
      )}
      {!text && isLastAssistant && busy && steps.length === 0 && !showAgent && (
        <div className="flex items-center gap-2 px-1 text-xs text-zinc-500">
          <Loader2 className="size-3.5 animate-spin" />
          Thinking…
        </div>
      )}
      {price && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              {price.symbol} · {price.timeframe ?? "1D"} · OHLCV
            </p>
            {price.last != null && (
              <p className="font-mono text-sm text-zinc-200">
                ${price.last.toFixed(2)}
                {price.changePct != null && (
                  <span
                    className={
                      price.changePct >= 0
                        ? "ml-2 text-emerald-400"
                        : "ml-2 text-red-400"
                    }
                  >
                    {price.changePct >= 0 ? "+" : ""}
                    {price.changePct.toFixed(1)}%
                  </span>
                )}
              </p>
            )}
          </div>
          <PriceChart series={price.series!} />
        </div>
      )}
      <CitationsCard hits={citations} />
      {ta && <DemoTaCard snap={ta} />}
      {text && (
        <div className="px-1 py-1 text-sm text-zinc-200">
          <Markdown>{text}</Markdown>
          {busy && isLastAssistant && (
            <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-zinc-500 align-middle" />
          )}
        </div>
      )}
      {portfolios.map((p, idx) => (
        <PortfolioCard key={`${message.id}-pf-${idx}`} snap={p} />
      ))}
      {clarifications.map((c, idx) => (
        <ClarificationCard key={`${message.id}-ask-${idx}`} item={c} />
      ))}
      {multiPlans.map((p, idx) => (
        <DemoMultiStepCard key={`${message.id}-multi-${idx}`} plan={p} />
      ))}
      {reviews.map((r, idx) => (
        <DemoPlanCard key={`${message.id}-plan-${idx}`} review={r} />
      ))}
    </div>
  );
}

export function DemoChatPanel({ chatId }: { chatId: string }) {
  if (isTaLiveChat(chatId)) {
    return <TaLiveSession />;
  }
  return <FixtureChatPanel chatId={chatId} />;
}

function FixtureChatPanel({ chatId }: { chatId: string }) {
  const chat = getDemoChat(chatId);
  const { messages, busy, preferAgentOpen } = useDemoPlayback(chat);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  if (!chat) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Chat not found.
      </div>
    );
  }

  const lastId = messages[messages.length - 1]?.id;

  return (
    <div className="relative flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
          Chat
        </p>
        <h1 className="text-sm font-medium text-zinc-100">{chat.title}</h1>
      </div>
      <div className="cipher-scroll flex-1 overflow-y-auto pb-36">
        <div className="mx-auto flex w-full max-w-[57.6rem] flex-col gap-6 px-4 py-8">
          {messages.map((m) => (
            <DemoMessage
              key={m.id}
              message={m}
              isLastAssistant={m.role === "assistant" && m.id === lastId}
              busy={busy && m.id === lastId}
              preferAgentOpen={preferAgentOpen}
            />
          ))}
          {messages.length === 0 && busy && (
            <div className="flex items-center gap-2 px-1 text-xs text-zinc-500">
              <Loader2 className="size-3.5 animate-spin" />
              Waiting for prompt…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      <ChatComposer
        value={input}
        onChange={setInput}
        onSubmit={() => setInput("")}
        busy={busy}
      />
    </div>
  );
}
