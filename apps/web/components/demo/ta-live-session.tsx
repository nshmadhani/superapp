"use client";

import { useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { Loader2 } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { AgentRunView } from "@/components/chat/agent-run";
import { ChatComposer } from "@/components/chat/chat-composer";
import { CitationsCard } from "@/components/chat/cards";
import {
  extractAgentSteps,
  extractCitations,
  textFromParts,
  toolOutput,
} from "@/components/chat/tool-extractors";
import { DemoTaCard, type TaSnapshot } from "./demo-ta-card";
import { ProTaChart } from "./pro-ta-chart";
import {
  analyzeOhlc,
  buildTaWriteup,
  type OhlcBar,
  type TaAnalysis,
} from "@/lib/demo/ta-from-ohlc";

const TA_CHAT_ID = "e8c14f57-2a9b-4e60-8d3c-5f1a7b0e9264";

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

const SEARCH_HITS = [
  {
    title: "CoinGecko: Hyperliquid (HYPE)",
    url: "https://www.coingecko.com/en/coins/hyperliquid",
    content: "Live market reference used for OHLC in this session.",
  },
  {
    title: "TradingView HYPEUSD",
    url: "https://www.tradingview.com/symbols/HYPEUSD/",
    content: "How desks mark daily structure on the same tape.",
  },
];

function MessageView({
  message,
  isLast,
  busy,
  candles,
  analysis,
  feedMeta,
}: {
  message: UIMessage;
  isLast?: boolean;
  busy?: boolean;
  candles: OhlcBar[];
  analysis: TaAnalysis | null;
  feedMeta?: { source?: string; asOf?: string; candleCount?: number };
}) {
  const steps = extractAgentSteps(message.parts);
  const citations = extractCitations(message.parts);
  const text = textFromParts(message.parts);
  const priceOut = (() => {
    for (const p of message.parts ?? []) {
      const o = toolOutput(p) as { type?: string } | undefined;
      if (o?.type === "price_series") return o;
    }
    return null;
  })();
  const taOut = (() => {
    for (const p of message.parts ?? []) {
      const o = toolOutput(p) as TaSnapshot | undefined;
      if (o?.type === "ta_snapshot") return o;
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
      {priceOut && candles.length > 0 && (
        <ProTaChart
          candles={candles}
          analysis={analysis}
          meta={feedMeta}
        />
      )}
      <CitationsCard hits={citations} />
      {taOut && (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Simple read
          </p>
          <DemoTaCard snap={taOut} />
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

export function TaLiveSession() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [busy, setBusy] = useState(true);
  const [candles, setCandles] = useState<OhlcBar[]>([]);
  const [analysis, setAnalysis] = useState<TaAnalysis | null>(null);
  const [feedMeta, setFeedMeta] = useState<{
    source?: string;
    asOf?: string;
    candleCount?: number;
  }>({});
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
          "Can you run a proper TA on HYPE for me? Pull the real daily candles, mark the chart the way a desk would, then explain the simple read. Bias, levels, and if a short still makes sense.";

        setMessages([
          { id: "t1", role: "user", parts: [{ type: "text", text: "" }] },
        ]);
        for (let i = 0; i < prompt.length; i++) {
          const slice = prompt.slice(0, i + 1);
          setMessages([
            { id: "t1", role: "user", parts: [{ type: "text", text: slice }] },
          ]);
          const ch = prompt[i]!;
          const delay =
            ch === " "
              ? 55
              : ch === "," || ch === "?" || ch === "."
                ? 180
                : 70 + (i % 5) * 8;
          await sleep(delay, signal);
        }
        await sleep(1400, signal);

        setMessages((prev) => [
          ...prev,
          { id: "t2", role: "assistant", parts: [] },
        ]);
        await sleep(900, signal);

        // Tool 1: fetch real OHLC
        setMessages((prev) =>
          prev.map((m) =>
            m.id === "t2"
              ? {
                  ...m,
                  parts: [
                    toolPart(
                      "get_price_history",
                      undefined,
                      "tc-ohlcv",
                      "input-available",
                      { coin: "hyperliquid", days: 90, timeframe: "1D" },
                    ),
                  ],
                }
              : m,
          ),
        );

        const res = await fetch("/api/market/ohlc?coin=hyperliquid&days=90");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "OHLC fetch failed");
        const bars = (data.candles ?? []) as OhlcBar[];
        if (!bars.length) throw new Error("No candles returned");
        setCandles(bars);
        setFeedMeta({
          source: data.source,
          asOf: data.asOf,
          candleCount: bars.length,
        });

        const closes = bars.map((b) => b.close);
        const last = closes[closes.length - 1]!;
        const first = closes[0]!;
        const high90 = Math.max(...bars.map((b) => b.high));
        const low90 = Math.min(...bars.map((b) => b.low));
        const priceSeries = {
          type: "price_series",
          symbol: "HYPE",
          timeframe: "1D",
          lookbackDays: 90,
          source: data.source ?? "coingecko_market_chart",
          candleCount: bars.length,
          series: closes,
          last,
          changePct: ((last - first) / first) * 100,
          high90,
          low90,
          asOf: data.asOf,
        };

        await sleep(2200, signal);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === "t2"
              ? {
                  ...m,
                  parts: [
                    toolPart(
                      "get_price_history",
                      priceSeries,
                      "tc-ohlcv",
                      "output-available",
                      { coin: "hyperliquid", days: 90 },
                    ),
                  ],
                }
              : m,
          ),
        );
        await sleep(2800, signal);

        // Tool 2: search
        setMessages((prev) =>
          prev.map((m) =>
            m.id === "t2"
              ? {
                  ...m,
                  parts: [
                    ...m.parts,
                    toolPart(
                      "web_search",
                      undefined,
                      "tc-search",
                      "input-available",
                      { query: "HYPE USD daily structure" },
                    ),
                  ],
                }
              : m,
          ),
        );
        await sleep(2400, signal);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === "t2"
              ? {
                  ...m,
                  parts: m.parts.map((p) =>
                    "toolCallId" in p &&
                    (p as { toolCallId?: string }).toolCallId === "tc-search"
                      ? toolPart(
                          "web_search",
                          { results: SEARCH_HITS },
                          "tc-search",
                          "output-available",
                        )
                      : p,
                  ),
                }
              : m,
          ),
        );
        await sleep(1600, signal);

        // Tool 3: analyze from real bars
        setMessages((prev) =>
          prev.map((m) =>
            m.id === "t2"
              ? {
                  ...m,
                  parts: [
                    ...m.parts,
                    toolPart(
                      "analyze_technicals",
                      undefined,
                      "tc-analyze",
                      "input-available",
                      {
                        methods: [
                          "structure",
                          "ema",
                          "rsi",
                          "sr_boxes",
                          "volume",
                        ],
                      },
                    ),
                  ],
                }
              : m,
          ),
        );

        const snap = analyzeOhlc(bars, { symbol: "HYPE", timeframe: "1D" });
        setAnalysis(snap);
        await sleep(3200, signal);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === "t2"
              ? {
                  ...m,
                  parts: m.parts.map((p) =>
                    "toolCallId" in p &&
                    (p as { toolCallId?: string }).toolCallId === "tc-analyze"
                      ? toolPart(
                          "analyze_technicals",
                          snap,
                          "tc-analyze",
                          "output-available",
                        )
                      : p,
                  ),
                }
              : m,
          ),
        );

        const writeup = buildTaWriteup(snap);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === "t2"
              ? {
                  ...m,
                  parts: [...m.parts, { type: "text", text: "" }],
                }
              : m,
          ),
        );
        await sleep(800, signal);
        const step = 2;
        for (let i = 0; i < writeup.length; i += step) {
          const slice = writeup.slice(0, Math.min(i + step, writeup.length));
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== "t2") return m;
              const parts = [...m.parts];
              for (let j = parts.length - 1; j >= 0; j--) {
                if (parts[j]?.type === "text") {
                  parts[j] = { type: "text", text: slice };
                  break;
                }
              }
              return { ...m, parts };
            }),
          );
          await sleep(28, signal);
        }

        setBusy(false);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "TA session failed");
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
        <h1 className="text-sm font-medium text-zinc-100">
          Technical analysis
        </h1>
        <p className="mt-0.5 text-[11px] text-zinc-600">
          Live CoinGecko daily candles. Desk chart first, then a plain read.
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
              candles={candles}
              analysis={analysis}
              feedMeta={feedMeta}
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

export function isTaLiveChat(chatId: string) {
  return chatId === TA_CHAT_ID;
}
