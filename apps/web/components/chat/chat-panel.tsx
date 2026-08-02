"use client";

import { Chat, useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatComposer } from "./chat-composer";
import { ChatMessage } from "./chat-message";
import { ChatEmptyState } from "./empty-state";
import { useStickToBottom } from "./use-stick-to-bottom";
import { parseTransferSubmitted } from "@/lib/transfer-submitted";
import { textFromParts } from "./tool-extractors";
import { useChatRuntime } from "./chat-runtime";

function dbRowToUIMessage(m: {
  id: string;
  role: string;
  content: {
    text?: string;
    parts?: UIMessage["parts"];
    id?: string;
  };
}): UIMessage {
  const parts =
    Array.isArray(m.content?.parts) && m.content.parts.length > 0
      ? m.content.parts
      : [{ type: "text" as const, text: m.content?.text ?? "" }];
  // Prefer DB row id — content.id can repeat across persisted rows and
  // collide as React keys when the same assistant turn was saved more than once.
  return {
    id: m.id,
    role: m.role as "user" | "assistant",
    parts,
  };
}

export function ChatPanel({
  chatId,
  onMissingChat,
}: {
  chatId: string;
  onMissingChat?: () => void;
}) {
  const runtime = useChatRuntime();
  const [input, setInput] = useState("");
  // Bump after ensure/fetch so we re-render when a session appears in the registry.
  const [, setSessionEpoch] = useState(0);
  const chat = runtime.getChat(chatId);

  useEffect(() => {
    let cancelled = false;
    runtime.setVisible(chatId, true);

    // Existing runtime session: no bootstrap needed (avoid sync setState here).
    if (runtime.getChat(chatId)) {
      return () => {
        cancelled = true;
        runtime.setVisible(chatId, false);
      };
    }

    void (async () => {
      const res = await fetch(`/api/chats/${chatId}`);
      if (cancelled) return;
      if (res.status === 404) {
        onMissingChat?.();
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (cancelled) return;
      const msgs: UIMessage[] = (data.messages ?? []).map(dbRowToUIMessage);
      runtime.ensureChat(chatId, msgs);
      // Async continuation — re-render so getChat(chatId) resolves.
      if (!cancelled) setSessionEpoch((n) => n + 1);
    })();

    return () => {
      cancelled = true;
      runtime.setVisible(chatId, false);
    };
  }, [chatId, onMissingChat, runtime]);

  if (!chat) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading chat…
      </div>
    );
  }

  return (
    <ChatInner
      key={chatId}
      chat={chat}
      chatId={chatId}
      input={input}
      setInput={setInput}
    />
  );
}

function ChatInner({
  chat,
  chatId,
  input,
  setInput,
}: {
  chat: Chat<UIMessage>;
  chatId: string;
  input: string;
  setInput: (v: string) => void;
}) {
  const { messages, sendMessage, status, error, stop, regenerate, clearError } =
    useChat({ chat });
  const [submittedPlanIdsLocal, setSubmittedPlanIds] = useState<Set<string>>(
    () => new Set(),
  );
  const pendingSent = useRef(false);
  const busy = status !== "ready";
  const { endRef, scrollerRef, onScroll } = useStickToBottom([
    messages,
    status,
  ]);

  useEffect(() => {
    if (pendingSent.current || status !== "ready") return;
    const key = `ervo:pending:${chatId}`;
    const pending = sessionStorage.getItem(key);
    if (!pending) return;
    sessionStorage.removeItem(key);
    pendingSent.current = true;
    void sendMessage({ text: pending });
  }, [chatId, sendMessage, status]);

  function send(text: string) {
    clearError?.();
    void sendMessage({ text });
    setInput("");
  }

  function onTxOutcome(outcome: {
    status: "approved" | "rejected";
    planId?: string;
    agentPayload?: string;
  }) {
    if (outcome.status === "approved" && outcome.planId) {
      setSubmittedPlanIds((prev) => {
        const next = new Set(prev);
        next.add(outcome.planId!);
        return next;
      });
    }
    if (outcome.status !== "approved" || !outcome.agentPayload) return;
    clearError?.();
    void sendMessage({ text: outcome.agentPayload });
  }

  const submittedPlanIds = useMemo(() => {
    const ids = new Set(submittedPlanIdsLocal);
    for (const m of messages) {
      const text = textFromParts(m.parts);
      const payload = parseTransferSubmitted(text);
      if (payload?.planId) ids.add(payload.planId);
    }
    return ids;
  }, [messages, submittedPlanIdsLocal]);

  const lastAssistantId = [...messages]
    .reverse()
    .find((m) => m.role === "assistant")?.id;

  return (
    <div className="relative flex h-full w-full flex-col">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="ervo-scroll flex-1 overflow-y-auto px-4 pb-28 pt-6"
      >
        <div className="mx-auto w-full max-w-[57.6rem]">
          {messages.length === 0 && (
            <ChatEmptyState onSuggest={(t) => send(t)} />
          )}
          <div className="mx-auto w-[90%] space-y-6">
            {messages.map((m, i) => (
              <ChatMessage
                key={`${m.id}-${i}`}
                message={m}
                isLastAssistant={m.id === lastAssistantId}
                busy={busy}
                onRegenerate={() => void regenerate()}
                onClarify={(text) => send(text)}
                onTxOutcome={onTxOutcome}
                submittedPlanIds={submittedPlanIds}
              />
            ))}
            {busy && messages[messages.length - 1]?.role === "user" && (
              <ChatMessage
                message={{
                  id: "pending-assistant",
                  role: "assistant",
                  parts: [],
                }}
                isLastAssistant
                busy
              />
            )}
            <div ref={endRef} />
          </div>
        </div>
      </div>

      <ChatComposer
        value={input}
        onChange={setInput}
        onSubmit={send}
        onStop={() => stop()}
        busy={busy}
        error={error?.message ?? null}
      />
    </div>
  );
}
