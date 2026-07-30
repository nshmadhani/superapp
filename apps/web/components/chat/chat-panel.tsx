"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatComposer } from "./chat-composer";
import { ChatMessage } from "./chat-message";
import { ChatEmptyState } from "./empty-state";
import { useStickToBottom } from "./use-stick-to-bottom";
import { parseTransferSubmitted } from "@/lib/transfer-submitted";
import { textFromParts } from "./tool-extractors";

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
  const [input, setInput] = useState("");
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(
    null,
  );
  const { wallets } = useTurnkey();
  const signableAddressesRef = useRef<string[]>([]);

  /** Live Turnkey session accounts — what Confirm can actually sign with. */
  const signableAddresses = useMemo(() => {
    const out: string[] = [];
    for (const w of wallets ?? []) {
      for (const a of w.accounts ?? []) {
        if (a?.address) out.push(String(a.address));
      }
    }
    return out;
  }, [wallets]);

  useEffect(() => {
    signableAddressesRef.current = signableAddresses;
  }, [signableAddresses]);

  useEffect(() => {
    let cancelled = false;
    setInitialMessages(null);
    void (async () => {
      const res = await fetch(`/api/chats/${chatId}`);
      if (res.status === 404) {
        onMissingChat?.();
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (cancelled) return;
      const msgs: UIMessage[] = (data.messages ?? []).map(dbRowToUIMessage);
      setInitialMessages(msgs);
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId, onMissingChat]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, id, trigger, messageId }) => ({
          body: {
            id,
            messages,
            trigger,
            messageId,
            chatId,
            signableAddresses: signableAddressesRef.current,
          },
        }),
      }),
    [chatId],
  );

  if (initialMessages === null) {
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
      chatId={chatId}
      transport={transport}
      initialMessages={initialMessages}
      input={input}
      setInput={setInput}
    />
  );
}

function ChatInner({
  chatId,
  transport,
  initialMessages,
  input,
  setInput,
}: {
  chatId: string;
  transport: DefaultChatTransport<UIMessage>;
  initialMessages: UIMessage[];
  input: string;
  setInput: (v: string) => void;
}) {
  const { messages, sendMessage, status, error, stop, regenerate, clearError } =
    useChat({
      transport,
      messages: initialMessages,
    });
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
