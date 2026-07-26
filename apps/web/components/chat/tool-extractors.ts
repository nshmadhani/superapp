import type { UIMessage } from "ai";
import type { ComponentProps } from "react";
import type { TxReviewCard } from "../tx-review-modal";

export type PlanReview = ComponentProps<typeof TxReviewCard>["review"];

export type SearchHit = { title: string; url: string; content: string };

export type PortfolioSnap = {
  address?: string;
  label?: string;
  totalValueUsd: number;
  type?: string;
  positions: Array<{
    symbol: string;
    name: string;
    quantity: string;
    valueUsd: number | null;
    walletLabel?: string;
  }>;
  wallets?: Array<{
    walletId: string;
    label?: string;
    totalValueUsd: number;
    chainFamily?: string;
  }>;
};

export type Clarification = {
  type: "clarification";
  question: string;
  options: string[];
};

export type SpawnedAgent = {
  runId: string;
  type: string;
  status: string;
  href: string;
  message?: string;
};

export type AgentStep = {
  key: string;
  toolName: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

export function toolOutput(part: UIMessage["parts"][number]): unknown {
  if (
    part &&
    typeof part === "object" &&
    "type" in part &&
    String(part.type).startsWith("tool-") &&
    "output" in part
  ) {
    return (part as { output?: unknown }).output;
  }
  return undefined;
}

export function extractAgentSteps(parts: UIMessage["parts"]): AgentStep[] {
  const steps: AgentStep[] = [];
  for (const [i, part] of (parts ?? []).entries()) {
    if (!part || typeof part !== "object" || !("type" in part)) continue;
    const type = String(part.type);
    if (!type.startsWith("tool-")) continue;
    const toolName = type.replace(/^tool-/, "");
    const p = part as {
      state?: string;
      input?: unknown;
      output?: unknown;
      errorText?: string;
      toolCallId?: string;
    };
    steps.push({
      key: p.toolCallId ?? `${toolName}-${i}`,
      toolName,
      state: p.state,
      input: p.input,
      output: p.output,
      errorText: p.errorText,
    });
  }
  return steps;
}

export function extractPlanReviews(parts: UIMessage["parts"]): PlanReview[] {
  const reviews: PlanReview[] = [];
  for (const part of parts ?? []) {
    const output = toolOutput(part) as { type?: string } | undefined;
    if (output && output.type === "plan_review") {
      reviews.push(output as PlanReview);
    }
  }
  return reviews;
}

export function extractCitations(parts: UIMessage["parts"]): SearchHit[] {
  const hits: SearchHit[] = [];
  for (const part of parts ?? []) {
    if (!part || typeof part !== "object" || !("type" in part)) continue;
    if (String(part.type) !== "tool-web_search") continue;
    const output = toolOutput(part) as { results?: SearchHit[] } | undefined;
    for (const r of output?.results ?? []) {
      if (r?.url && r?.title) hits.push(r);
    }
  }
  return hits;
}

export function extractPortfolios(parts: UIMessage["parts"]): PortfolioSnap[] {
  const snaps: PortfolioSnap[] = [];
  for (const part of parts ?? []) {
    if (!part || typeof part !== "object" || !("type" in part)) continue;
    if (String(part.type) !== "tool-get_portfolio") continue;
    const output = toolOutput(part) as
      | (PortfolioSnap & { error?: string })
      | undefined;
    if (
      output &&
      !output.error &&
      (output.address || output.type === "portfolio_overview")
    ) {
      snaps.push(output);
    }
  }
  return snaps;
}

export function extractClarifications(
  parts: UIMessage["parts"],
): Clarification[] {
  const out: Clarification[] = [];
  for (const part of parts ?? []) {
    if (!part || typeof part !== "object" || !("type" in part)) continue;
    if (String(part.type) !== "tool-ask_user") continue;
    const output = toolOutput(part) as Clarification | undefined;
    if (output?.type === "clarification" && output.question) {
      out.push({
        type: "clarification",
        question: output.question,
        options: output.options ?? [],
      });
    }
  }
  return out;
}

export function extractSpawnedAgents(parts: UIMessage["parts"]): SpawnedAgent[] {
  const out: SpawnedAgent[] = [];
  for (const part of parts ?? []) {
    if (!part || typeof part !== "object" || !("type" in part)) continue;
    if (String(part.type) !== "tool-spawn_agent") continue;
    const output = toolOutput(part) as SpawnedAgent | undefined;
    if (output?.runId && output?.href) out.push(output);
  }
  return out;
}

export function textFromParts(parts: UIMessage["parts"] | undefined): string {
  return (parts ?? [])
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
}
