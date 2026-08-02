"use client";

import type { UIMessage } from "ai";
import { Loader2 } from "lucide-react";
import { Markdown } from "../markdown";
import { TxReviewCard, type TxReviewOutcome } from "../tx-review-modal";
import { AgentRunView } from "./agent-run";
import {
  CitationsCard,
  ClarificationCard,
  SpawnAgentCard,
  TransferSubmittedCard,
} from "./cards";
import { MessageActions } from "./message-actions";
import {
  extractAgentSteps,
  extractCitations,
  extractClarifications,
  extractPlanReviews,
  extractSpawnedAgents,
  textFromParts,
} from "./tool-extractors";
import { parseTransferSubmitted } from "@/lib/transfer-submitted";

export function ChatMessage({
  message,
  isLastAssistant,
  busy,
  onRegenerate,
  onClarify,
  onTxOutcome,
  submittedPlanIds,
}: {
  message: UIMessage;
  isLastAssistant?: boolean;
  busy?: boolean;
  onRegenerate?: () => void;
  onClarify?: (text: string) => void;
  onTxOutcome?: (outcome: TxReviewOutcome) => void;
  submittedPlanIds?: Set<string>;
}) {
  const steps = extractAgentSteps(message.parts);
  const reviews = extractPlanReviews(message.parts);
  const citations = extractCitations(message.parts);
  const clarifications = extractClarifications(message.parts);
  const spawned = extractSpawnedAgents(message.parts);
  const text = textFromParts(message.parts);
  const transferSubmitted = parseTransferSubmitted(text);
  const showAgent =
    message.role === "assistant" &&
    (steps.length > 0 || (isLastAssistant && busy));

  if (message.role === "user") {
    if (transferSubmitted) {
      return (
        <div className="group/msg w-full">
          <TransferSubmittedCard payload={transferSubmitted} />
        </div>
      );
    }
    return (
      <div className="group/msg w-full">
        <div className="w-full rounded-2xl bg-zinc-800 px-4 py-3 text-sm text-zinc-50">
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            {text}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="group/msg flex w-full flex-col gap-3">
      {showAgent && (
        <AgentRunView
          steps={steps}
          running={Boolean(isLastAssistant && busy)}
        />
      )}

      {text && (
        <div className="px-1 py-1 text-sm text-zinc-200">
          <Markdown>{text}</Markdown>
        </div>
      )}

      {!text && isLastAssistant && busy && steps.length === 0 && (
        <div className="flex items-center gap-2 px-1 text-xs text-zinc-500">
          <Loader2 className="size-3.5 animate-spin" />
          Thinking…
        </div>
      )}

      <CitationsCard hits={citations} />
      {clarifications.map((c, idx) => (
        <ClarificationCard
          key={`${message.id}-ask-${idx}`}
          item={c}
          onChoose={onClarify}
        />
      ))}
      {reviews.map((r, idx) => (
        <TxReviewCard
          key={`${message.id}-plan-${idx}`}
          review={r}
          alreadySubmitted={submittedPlanIds?.has(r.planId)}
          onOutcome={(outcome) => onTxOutcome?.(outcome)}
        />
      ))}
      {spawned.map((s) => (
        <SpawnAgentCard key={s.runId} run={s} />
      ))}

      {(text || onRegenerate) && (
        <MessageActions
          text={text}
          showRegenerate={isLastAssistant && !busy}
          onRegenerate={onRegenerate}
        />
      )}
    </div>
  );
}
