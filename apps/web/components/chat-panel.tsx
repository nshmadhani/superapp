"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "./markdown";
import { TxReviewCard } from "./tx-review-modal";
import { walletDisplayName } from "@/lib/wallet-display";

type PlanReview = Parameters<typeof TxReviewCard>[0]["review"];

type SearchHit = { title: string; url: string; content: string };

type PortfolioSnap = {
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

function toolOutput(part: UIMessage["parts"][number]): unknown {
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

function extractPlanReviews(parts: UIMessage["parts"]): PlanReview[] {
  const reviews: PlanReview[] = [];
  for (const part of parts ?? []) {
    const output = toolOutput(part) as { type?: string } | undefined;
    if (output && output.type === "plan_review") {
      reviews.push(output as PlanReview);
    }
  }
  return reviews;
}

function extractCitations(parts: UIMessage["parts"]): SearchHit[] {
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

function extractPortfolios(parts: UIMessage["parts"]): PortfolioSnap[] {
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

function CitationsCard({ hits }: { hits: SearchHit[] }) {
  if (!hits.length) return null;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        Sources
      </p>
      <ul className="space-y-1.5">
        {hits.slice(0, 5).map((h) => (
          <li key={h.url}>
            <a
              href={h.url}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex max-w-full items-start gap-1.5 text-xs text-zinc-300 hover:text-zinc-100"
            >
              <ExternalLink className="mt-0.5 size-3 shrink-0 text-zinc-600 group-hover:text-zinc-400" />
              <span className="truncate">{h.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PortfolioCard({ snap }: { snap: PortfolioSnap }) {
  const isOverview = snap.type === "portfolio_overview";
  const title = isOverview
    ? "Overview"
    : walletDisplayName({ label: snap.label, source: "turnkey" });
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2.5 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          {title}
        </p>
        {!isOverview && snap.address && (
          <p className="font-mono text-[11px] text-zinc-600">
            {snap.address.slice(0, 4)}…{snap.address.slice(-4)}
          </p>
        )}
      </div>
      <p className="text-xl font-semibold text-zinc-100">
        $
        {snap.totalValueUsd.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}
      </p>
      {isOverview && snap.wallets && snap.wallets.length > 0 && (
        <ul className="space-y-1 border-b border-zinc-800 pb-2">
          {snap.wallets.map((w) => (
            <li
              key={w.walletId}
              className="flex justify-between gap-2 text-xs text-zinc-400"
            >
              <span className="text-zinc-200">
                {walletDisplayName({ label: w.label })}
              </span>
              <span>
                $
                {w.totalValueUsd.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
      <ul className="space-y-1">
        {snap.positions.slice(0, 8).map((p, i) => (
          <li
            key={`${p.symbol}-${i}`}
            className="flex justify-between gap-2 text-xs text-zinc-400"
          >
            <span>
              <span className="text-zinc-200">{p.symbol}</span>
              {isOverview && p.walletLabel && (
                <span className="ml-1.5 text-zinc-600">
                  · {walletDisplayName({ label: p.walletLabel })}
                </span>
              )}
              <span className="ml-1.5 text-zinc-600">{p.quantity}</span>
            </span>
            <span>
              {p.valueUsd == null
                ? "—"
                : `$${p.valueUsd.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
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
      const msgs: UIMessage[] = (data.messages ?? []).map(
        (m: { id: string; role: string; content: { text?: string } }) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          parts: [{ type: "text" as const, text: m.content?.text ?? "" }],
        }),
      );
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
        body: { chatId },
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
  const { messages, sendMessage, status, error } = useChat({
    transport,
    messages: initialMessages,
  });
  const endRef = useRef<HTMLDivElement>(null);
  const pendingSent = useRef(false);
  const busy = status !== "ready";

  useEffect(() => {
    if (pendingSent.current || status !== "ready") return;
    const key = `cipher:pending:${chatId}`;
    const pending = sessionStorage.getItem(key);
    if (!pending) return;
    sessionStorage.removeItem(key);
    pendingSent.current = true;
    void sendMessage({ text: pending });
  }, [chatId, sendMessage, status]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, status]);

  return (
    <div className="relative mx-auto flex h-full w-full max-w-3xl flex-col">
      <div className="cipher-scroll flex-1 overflow-y-auto px-4 pb-36 pt-8">
        {messages.length === 0 && (
          <div className="flex h-[50vh] flex-col items-center justify-center gap-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
              Cipher
            </h1>
            <p className="max-w-sm text-sm text-zinc-500">
              Ask about portfolios, research markets, or plan a trade.
            </p>
          </div>
        )}
        <div className="space-y-6">
          {messages.map((m) => {
            const reviews = extractPlanReviews(m.parts);
            const citations = extractCitations(m.parts);
            const portfolios = extractPortfolios(m.parts);
            return (
              <div key={m.id} className="space-y-3">
                <div
                  className={
                    m.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl bg-zinc-800 px-4 py-3 text-sm text-zinc-50"
                      : "mr-auto max-w-[92%] px-1 py-1 text-sm text-zinc-200"
                  }
                >
                  {m.parts?.map((part, i) => {
                    if (part.type === "text") {
                      if (m.role === "assistant") {
                        return <Markdown key={i}>{part.text}</Markdown>;
                      }
                      return (
                        <p
                          key={i}
                          className="whitespace-pre-wrap leading-relaxed"
                        >
                          {part.text}
                        </p>
                      );
                    }
                    if (String(part.type).startsWith("tool-")) {
                      const name = String(part.type).replace("tool-", "");
                      return (
                        <div
                          key={i}
                          className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 font-mono text-[11px] text-zinc-500"
                        >
                          {name}
                          {"state" in part ? ` · ${String(part.state)}` : ""}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
                {portfolios.map((p, idx) => (
                  <PortfolioCard key={`${m.id}-pf-${idx}`} snap={p} />
                ))}
                <CitationsCard hits={citations} />
                {reviews.map((r, idx) => (
                  <TxReviewCard key={`${m.id}-plan-${idx}`} review={r} />
                ))}
              </div>
            );
          })}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="size-3.5 animate-spin" />
              Thinking…
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent px-4 pb-4 pt-10">
        <div className="pointer-events-auto mx-auto max-w-3xl">
          {error && (
            <p className="mb-2 text-center text-sm text-red-400">
              {error.message}
            </p>
          )}
          <form
            className="flex items-end gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-2 shadow-lg shadow-black/40 backdrop-blur"
            onSubmit={(e) => {
              e.preventDefault();
              if (!input.trim() || busy) return;
              void sendMessage({ text: input });
              setInput("");
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!input.trim() || busy) return;
                  void sendMessage({ text: input });
                  setInput("");
                }
              }}
              rows={1}
              placeholder="Message Cipher…"
              className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="mb-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-950 transition-opacity hover:bg-white disabled:opacity-30"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </button>
          </form>
          <p className="mt-2 text-center text-[11px] text-zinc-600">
            Cipher can make mistakes. Review plans before executing.
          </p>
        </div>
      </div>
    </div>
  );
}
