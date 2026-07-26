"use client";

import type { UIMessage } from "ai";
import { Markdown } from "@/components/markdown";
import { AgentRunView } from "@/components/chat/agent-run";
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
import { getDemoChat } from "@/lib/demo/fixtures";

function extractMultiStepPlans(parts: UIMessage["parts"]): MultiStepPlan[] {
  const out: MultiStepPlan[] = [];
  for (const part of parts ?? []) {
    const output = toolOutput(part) as MultiStepPlan | undefined;
    if (output?.type === "multi_step_plan" && Array.isArray(output.legs)) {
      out.push(output);
    }
  }
  return out;
}

function DemoMessage({ message }: { message: UIMessage }) {
  const steps = extractAgentSteps(message.parts);
  const reviews = extractPlanReviews(message.parts);
  const multiPlans = extractMultiStepPlans(message.parts);
  const citations = extractCitations(message.parts);
  const portfolios = extractPortfolios(message.parts);
  const clarifications = extractClarifications(message.parts);
  const text = textFromParts(message.parts);

  if (message.role === "user") {
    return (
      <div className="w-full">
        <div className="w-full rounded-2xl bg-zinc-800 px-4 py-3 text-sm text-zinc-50">
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            {text}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {steps.length > 0 && <AgentRunView steps={steps} />}
      {text && (
        <div className="px-1 py-1 text-sm text-zinc-200">
          <Markdown>{text}</Markdown>
        </div>
      )}
      {portfolios.map((p, idx) => (
        <PortfolioCard key={`${message.id}-pf-${idx}`} snap={p} />
      ))}
      <CitationsCard hits={citations} />
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
  const chat = getDemoChat(chatId);
  if (!chat) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Demo chat not found.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
          Chat
        </p>
        <h1 className="text-sm font-medium text-zinc-100">{chat.title}</h1>
      </div>
      <div className="cipher-scroll flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[57.6rem] flex-col gap-6 px-4 py-8">
          {chat.messages.map((m) => (
            <DemoMessage key={m.id} message={m} />
          ))}
        </div>
      </div>
      <div className="border-t border-zinc-800 px-4 py-3 text-center text-xs text-zinc-600">
        Walkthrough mode — conversations are preloaded for the demo.
      </div>
    </div>
  );
}
