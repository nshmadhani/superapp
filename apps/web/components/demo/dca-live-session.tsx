"use client";

import { useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { Loader2 } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { AgentRunView } from "@/components/chat/agent-run";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ClarificationCard } from "@/components/chat/cards";
import {
  extractAgentSteps,
  extractClarifications,
  textFromParts,
  toolOutput,
} from "@/components/chat/tool-extractors";
import { DemoDcaCard, type DcaSnapshot } from "./demo-dca-card";
import { PriceChart } from "./sparkline";
import { SimpleDcaChart, type DcaWeekMark } from "./simple-dca-chart";
import { typeHuman } from "@/lib/demo/type-human";
import type { OhlcBar } from "@/lib/demo/ta-from-ohlc";

const DCA_CHAT_ID = "1a6d9e82-4f0c-48b5-9c27-3e5d8a1f7049";

const WEEKS: DcaWeekMark[] = [
  { label: "Jun 29", status: "bought", detail: "0.036 ETH · $149.88" },
  { label: "Jul 6", status: "skipped", detail: "ETH +14.2% WoW" },
  { label: "Jul 13", status: "bought", detail: "0.041 ETH · $150.00" },
  { label: "Jul 20", status: "bought", detail: "0.038 ETH · $149.92" },
  { label: "Jul 27", status: "next", detail: "Queued · agent funded" },
];

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = window.setTimeout(() => resolve(), ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(id);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function toolPart(
  toolName: string,
  output: unknown,
  toolCallId: string,
  state: "input-available" | "output-available",
  input?: unknown,
): UIMessage["parts"][number] {
  return {
    type: `tool-${toolName}`,
    toolCallId,
    state,
    input: input ?? {},
    output: state === "output-available" ? output : undefined,
  } as UIMessage["parts"][number];
}

function buildDcaSnapshot(includeGas: boolean): DcaSnapshot {
  const rails = [
    { label: "Max per buy", value: "$150 USDC" },
    { label: "Momentum skip", value: "ETH WoW > +12%" },
    { label: "Cadence", value: "Weekly · Mondays" },
  ];
  if (includeGas) {
    rails.splice(2, 0, {
      label: "Gas skip",
      value: "Base gas too high",
    });
  }
  return {
    type: "dca_snapshot",
    asset: "ETH",
    sizeUsd: 150,
    cadence: "Weekly · Mondays",
    chain: "Base",
    agentWallet: "0xDCA0…ef01",
    status: "active",
    guardRails: rails,
    stats: {
      buys: 3,
      skips: 1,
      spentUsd: 449.8,
      ethAccumulated: 0.115,
    },
    nextBuy: "Next · Monday",
  };
}

function buildDcaWriteup(includeGas: boolean): string {
  return `Locked in.

**Agent wallet:** \`0xDCA0…ef01\` (dedicated)
**Size / cadence:** $150 of ETH · every Monday
**Chain:** Base only
**Guard rails:** skip if ETH WoW > +12%${includeGas ? " · skip when Base gas is stupid" : ""}

It is running. The simple view shows buys, the momentum skip, and the next Monday queue. Open the **DCA** agent panel for the full activity log, or keep chatting here to tweak rules.`;
}

function MessageView({
  message,
  isLast,
  busy,
  ethSeries,
  snap,
}: {
  message: UIMessage;
  isLast?: boolean;
  busy?: boolean;
  ethSeries: number[];
  snap: DcaSnapshot | null;
}) {
  const steps = extractAgentSteps(message.parts);
  const clarifications = extractClarifications(message.parts);
  const text = textFromParts(message.parts);
  const priceOut = (() => {
    for (const p of message.parts ?? []) {
      const o = toolOutput(p) as { type?: string; last?: number } | undefined;
      if (o?.type === "price_series") return o;
    }
    return null;
  })();
  const dcaOut = (() => {
    for (const p of message.parts ?? []) {
      const o = toolOutput(p) as DcaSnapshot | undefined;
      if (o?.type === "dca_snapshot") return o;
    }
    return null;
  })();

  if (message.role === "user") {
    return (
      <div className="w-full rounded-2xl bg-zinc-800 px-4 py-3 text-sm text-zinc-50">
        <p className="whitespace-pre-wrap break-words leading-relaxed">
          {text}
          {busy && (
            <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-zinc-400 align-middle" />
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {(steps.length > 0 || (isLast && busy)) && (
        <AgentRunView
          steps={steps}
          running={Boolean(isLast && busy)}
          preferOpen={Boolean(isLast && busy)}
        />
      )}
      {clarifications.map((c, idx) => (
        <ClarificationCard key={`${message.id}-ask-${idx}`} item={c} />
      ))}
      {priceOut && ethSeries.length > 1 && (
        <div className="space-y-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  ETH tape · 90d
                </p>
                <p className="text-xs text-zinc-500">
                  Live CoinGecko context for the DCA buys.
                </p>
              </div>
              {priceOut.last != null && (
                <p className="font-mono text-sm text-zinc-200">
                  ${priceOut.last.toFixed(2)}
                </p>
              )}
            </div>
            <PriceChart series={ethSeries} />
          </div>
          {snap && (
            <SimpleDcaChart
              weeks={WEEKS}
              priceSeries={ethSeries}
              take="Boring on purpose. Skip the hot weeks. Keep buying the rest."
            />
          )}
        </div>
      )}
      {dcaOut && (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Simple read
          </p>
          <DemoDcaCard snap={dcaOut} />
        </div>
      )}
      {text && (
        <div className="px-1 py-1 text-sm text-zinc-200">
          <Markdown>{text}</Markdown>
          {busy && isLast && (
            <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-zinc-500 align-middle" />
          )}
        </div>
      )}
    </div>
  );
}

export function DcaLiveSession() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [busy, setBusy] = useState(true);
  const [ethSeries, setEthSeries] = useState<number[]>([]);
  const [snap, setSnap] = useState<DcaSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  useEffect(() => {
    const ac = new AbortController();
    const { signal } = ac;

    async function run() {
      setBusy(true);
      setMessages([]);
      setError(null);
      try {
        const prompt =
          "Set up a weekly DCA - about $150 of ETH, keep it boring and automated.";

        setMessages([
          { id: "c1", role: "user", parts: [{ type: "text", text: "" }] },
        ]);
        await typeHuman(prompt, {
          signal,
          typoRate: 0.05,
          onUpdate: (text) => {
            setMessages([
              { id: "c1", role: "user", parts: [{ type: "text", text }] },
            ]);
          },
        });
        await sleep(1100, signal);

        // Assistant asks for rails
        setMessages((prev) => [
          ...prev,
          {
            id: "c2",
            role: "assistant",
            parts: [
              toolPart(
                "ask_user",
                {
                  type: "clarification",
                  question: "Any hard rules for this agent?",
                  options: [
                    "Base only · skip if ETH +12% WoW",
                    "Base + Arbitrum · no skip rule",
                    "I will write custom guard rails",
                  ],
                },
                "tc-dca-ask",
                "output-available",
              ),
              {
                type: "text",
                text: "I can spin an autonomous DCA with its **own agent wallet**. You message here to change size, cadence, or guard rails anytime.",
              },
            ],
          },
        ]);
        await sleep(2200, signal);

        // User picks option
        const choice = "Base only · skip if ETH +12% WoW";
        setMessages((prev) => [
          ...prev,
          { id: "c3", role: "user", parts: [{ type: "text", text: "" }] },
        ]);
        await typeHuman(choice, {
          signal,
          typoRate: 0.04,
          onUpdate: (text) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === "c3"
                  ? { ...m, parts: [{ type: "text", text }] }
                  : m,
              ),
            );
          },
        });
        await sleep(1000, signal);

        setMessages((prev) => [
          ...prev,
          { id: "c4", role: "assistant", parts: [] },
        ]);
        await sleep(700, signal);

        // Tool: price context
        setMessages((prev) =>
          prev.map((m) =>
            m.id === "c4"
              ? {
                  ...m,
                  parts: [
                    toolPart(
                      "get_price_history",
                      undefined,
                      "tc-dca-eth",
                      "input-available",
                      { coin: "ethereum", days: 90 },
                    ),
                  ],
                }
              : m,
          ),
        );

        const res = await fetch("/api/market/ohlc?coin=ethereum&days=90");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "ETH OHLC fetch failed");
        const bars = (data.candles ?? []) as OhlcBar[];
        if (!bars.length) throw new Error("No ETH candles returned");
        const closes = bars.map((b) => b.close);
        const last = closes[closes.length - 1]!;
        const first = closes[0]!;
        setEthSeries(closes);

        const priceSeries = {
          type: "price_series",
          symbol: "ETH",
          timeframe: "1D",
          series: closes,
          last,
          changePct: ((last - first) / first) * 100,
          source: data.source,
          asOf: data.asOf,
        };

        await sleep(1800, signal);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === "c4"
              ? {
                  ...m,
                  parts: [
                    toolPart(
                      "get_price_history",
                      priceSeries,
                      "tc-dca-eth",
                      "output-available",
                      { coin: "ethereum", days: 90 },
                    ),
                  ],
                }
              : m,
          ),
        );
        await sleep(1200, signal);

        // Tool: create agent
        setMessages((prev) =>
          prev.map((m) =>
            m.id === "c4"
              ? {
                  ...m,
                  parts: [
                    ...m.parts,
                    toolPart(
                      "create_dca_agent",
                      undefined,
                      "tc-dca-create",
                      "input-available",
                      {
                        asset: "ETH",
                        sizeUsd: 150,
                        cadence: "weekly",
                        chain: "base",
                        skipIfWowPct: 12,
                      },
                    ),
                  ],
                }
              : m,
          ),
        );

        let dca = buildDcaSnapshot(false);
        setSnap(dca);
        await sleep(2600, signal);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === "c4"
              ? {
                  ...m,
                  parts: m.parts.map((p) =>
                    "toolCallId" in p &&
                    (p as { toolCallId?: string }).toolCallId === "tc-dca-create"
                      ? toolPart(
                          "create_dca_agent",
                          dca,
                          "tc-dca-create",
                          "output-available",
                          {
                            asset: "ETH",
                            sizeUsd: 150,
                            cadence: "weekly",
                            chain: "base",
                            skipIfWowPct: 12,
                          },
                        )
                      : p,
                  ),
                }
              : m,
          ),
        );

        setMessages((prev) =>
          prev.map((m) =>
            m.id === "c4"
              ? {
                  ...m,
                  parts: [...m.parts, { type: "text", text: "" }],
                }
              : m,
          ),
        );
        await sleep(600, signal);
        await typeHuman(buildDcaWriteup(false), {
          signal,
          typoRate: 0.02,
          speed: 2.2,
          onUpdate: (text) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== "c4") return m;
                const parts = [...m.parts];
                for (let j = parts.length - 1; j >= 0; j--) {
                  if (parts[j]?.type === "text") {
                    parts[j] = { type: "text", text };
                    break;
                  }
                }
                return { ...m, parts };
              }),
            );
          },
        });
        await sleep(1600, signal);

        // Follow-up: gas rail
        const gasPrompt =
          "Also dont buy if gas is stupid - add that guard rail.";
        setMessages((prev) => [
          ...prev,
          { id: "c5", role: "user", parts: [{ type: "text", text: "" }] },
        ]);
        await typeHuman(gasPrompt, {
          signal,
          typoRate: 0.055,
          onUpdate: (text) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === "c5"
                  ? { ...m, parts: [{ type: "text", text }] }
                  : m,
              ),
            );
          },
        });
        await sleep(900, signal);

        dca = buildDcaSnapshot(true);
        setSnap(dca);
        setMessages((prev) => [
          ...prev,
          {
            id: "c6",
            role: "assistant",
            parts: [
              toolPart(
                "update_dca_guard_rails",
                dca,
                "tc-dca-gas",
                "output-available",
                { gasSkip: "base_high" },
              ),
              {
                type: "text",
                text: "",
              },
            ],
          },
        ]);
        await sleep(500, signal);
        await typeHuman(
          "Added: **skip when Base gas is stupid** for the buy path. Activity log will show skips when that fires. Desk card above is updated.",
          {
            signal,
            typoRate: 0.02,
            speed: 2.3,
            onUpdate: (text) => {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== "c6") return m;
                  const parts = [...m.parts];
                  for (let j = parts.length - 1; j >= 0; j--) {
                    if (parts[j]?.type === "text") {
                      parts[j] = { type: "text", text };
                      break;
                    }
                  }
                  return { ...m, parts };
                }),
              );
            },
          },
        );

        setBusy(false);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "DCA session failed");
        setBusy(false);
      }
    }

    void run();
    return () => ac.abort();
  }, []);

  return (
    <div className="relative flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
          Chat
        </p>
        <h1 className="text-sm font-medium text-zinc-100">DCA agent</h1>
        <p className="mt-0.5 text-[11px] text-zinc-600">
          Live ETH tape, agent desk, then a plain schedule of buys and skips.
        </p>
      </div>
      <div className="cipher-scroll flex-1 overflow-y-auto pb-36">
        <div className="mx-auto flex w-full max-w-[57.6rem] flex-col gap-6 px-4 py-8">
          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          {messages.map((m) => (
            <MessageView
              key={m.id}
              message={m}
              isLast={m.id === messages[messages.length - 1]?.id}
              busy={busy && m.id === messages[messages.length - 1]?.id}
              ethSeries={ethSeries}
              snap={snap}
            />
          ))}
          {messages.length === 0 && busy && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="size-3.5 animate-spin" />
              Starting session…
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

export function isDcaLiveChat(chatId: string) {
  return chatId === DCA_CHAT_ID;
}
