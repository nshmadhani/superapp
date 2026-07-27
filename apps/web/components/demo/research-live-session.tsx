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
import {
  DemoResearchCard,
  type ResearchSnapshot,
} from "./demo-research-card";
import { PriceChart } from "./sparkline";
import { SimpleResearchChart } from "./simple-research-chart";
import { typeHuman } from "@/lib/demo/type-human";
import type { OhlcBar } from "@/lib/demo/ta-from-ohlc";

const RESEARCH_CHAT_ID = "b2e91d04-6c7a-4f83-a1d5-9e8c3b0f4712";

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
    title: "Hyperliquid - protocol overview",
    url: "https://hyperliquid.xyz/",
    content: "L1 perps venue. HYPE as gas / staking asset.",
  },
  {
    title: "Messari - HYPE research",
    url: "https://messari.io/report/hyperliquid",
    content: "Unlock schedule, float, competitive positioning vs CEX perps.",
  },
  {
    title: "DefiLlama - Hyperliquid TVL & volume",
    url: "https://defillama.com/protocol/hyperliquid",
    content: "Open interest and fee trends over the last quarter.",
  },
  {
    title: "X / Twitter - HYPE CT digest",
    url: "https://x.com/search?q=HYPE%20Hyperliquid",
    content:
      "CT split: bulls on volume leadership; bears on unlock overhang and copycats.",
  },
  {
    title: "CoinGecko: Hyperliquid (HYPE)",
    url: "https://www.coingecko.com/en/coins/hyperliquid",
    content: "Live market reference used for the price path in this session.",
  },
];

function buildResearchSnapshot(bars: OhlcBar[]): ResearchSnapshot {
  const closes = bars.map((b) => b.close);
  const last = closes[closes.length - 1]!;
  const first = closes[0]!;
  const high90 = Math.max(...bars.map((b) => b.high));
  const low90 = Math.min(...bars.map((b) => b.low));
  const changePct90 = ((last - first) / first) * 100;

  return {
    type: "research_snapshot",
    symbol: "HYPE",
    last: Math.round(last * 100) / 100,
    changePct90: Math.round(changePct90 * 10) / 10,
    high90: Math.round(high90 * 100) / 100,
    low90: Math.round(low90 * 100) / 100,
    narrative:
      "Bulls still call it the perps volume leader. Bears keep looping unlock calendar and copycat venues. Loud, not one-sided.",
    sentiment: "High attention, split conviction",
    thesis: "High-beta venue token, not a quiet compounder",
    risks: [
      "Unlock / distribution overhang",
      "Venue concentration and regulatory headlines",
      "Narrative rotation if volume cools",
    ],
    vsQuietBluechip:
      "Vs UNI: HYPE moves on CT + volume prints; UNI moves on slower fee-switch / DAO process.",
    scores: {
      attention: 9,
      unlockRisk: 7,
      volumeStrength: 8,
      governanceSignal: 3,
    },
  };
}

function buildResearchWriteup(snap: ResearchSnapshot): string {
  return `Okay, simple version.

**HYPE** is a **high-beta venue token**. The product is the perps exchange; the token rides **usage + staking / gas**, not a classic app-token flywheel.

**Street (CT)**
- Bulls: volume leadership, "CEX killer" memes, fee share chatter when prints are hot.
- Bears: unlock anxiety, copycats, "is OI sticky" every quiet week.
- Sentiment is loud and split. Good for attention trades, noisy for long-hold conviction.

**What the live tape shows**
Last **$${snap.last.toFixed(2)}** over this window (${snap.changePct90 >= 0 ? "+" : ""}${snap.changePct90.toFixed(1)}% from about **$${snap.low90.toFixed(2)}** to **$${snap.high90.toFixed(2)}**). The simple chart marks the attention peak and the unlock risk near spot.

**Risk flags**
1. ${snap.risks[0]}
2. ${snap.risks[1]}
3. ${snap.risks[2]}

**Vs a quieter bluechip (UNI)**
${snap.vsQuietBluechip}

Bottom line: trade it like a narrative + volume asset. Float and unlock pacing matter more than any single tweet. Want unlocks next, competitor fee wars, or a wallet-sized risk brief?`;
}

function MessageView({
  message,
  isLast,
  busy,
  series,
  snap,
}: {
  message: UIMessage;
  isLast?: boolean;
  busy?: boolean;
  series: number[];
  snap: ResearchSnapshot | null;
}) {
  const steps = extractAgentSteps(message.parts);
  const citations = extractCitations(message.parts);
  const text = textFromParts(message.parts);
  const priceOut = (() => {
    for (const p of message.parts ?? []) {
      const o = toolOutput(p) as {
        type?: string;
        last?: number;
        changePct?: number;
      } | undefined;
      if (o?.type === "price_series") return o;
    }
    return null;
  })();
  const researchOut = (() => {
    for (const p of message.parts ?? []) {
      const o = toolOutput(p) as ResearchSnapshot | undefined;
      if (o?.type === "research_snapshot") return o;
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
      {priceOut && series.length > 1 && (
        <div className="space-y-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Market path · HYPE · 90d
                </p>
                <p className="text-xs text-zinc-500">
                  Live CoinGecko closes. Desk context for the research pass.
                </p>
              </div>
              {priceOut.last != null && (
                <p className="font-mono text-sm text-zinc-200">
                  ${priceOut.last.toFixed(2)}
                  {priceOut.changePct != null && (
                    <span
                      className={
                        priceOut.changePct >= 0
                          ? "ml-2 text-emerald-400"
                          : "ml-2 text-red-400"
                      }
                    >
                      {priceOut.changePct >= 0 ? "+" : ""}
                      {priceOut.changePct.toFixed(1)}%
                    </span>
                  )}
                </p>
              )}
            </div>
            <PriceChart series={series} />
          </div>
          {snap && (
            <SimpleResearchChart
              series={series}
              last={snap.last}
              changePct={snap.changePct90}
              take={snap.thesis}
              attentionNote={snap.sentiment}
              riskNote="Risk · unlock overhang"
            />
          )}
        </div>
      )}
      <CitationsCard hits={citations} />
      {researchOut && (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Simple read
          </p>
          <DemoResearchCard snap={researchOut} />
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

export function ResearchLiveSession() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [busy, setBusy] = useState(true);
  const [series, setSeries] = useState<number[]>([]);
  const [snap, setSnap] = useState<ResearchSnapshot | null>(null);
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
          "Give me a full read on HYPE - not just governance. Whats the street saying, whats moving price, any risk flags?";

        setMessages([
          { id: "d1", role: "user", parts: [{ type: "text", text: "" }] },
        ]);
        await typeHuman(prompt, {
          signal,
          typoRate: 0.05,
          onUpdate: (text) => {
            setMessages([
              { id: "d1", role: "user", parts: [{ type: "text", text }] },
            ]);
          },
        });
        await sleep(1200, signal);

        setMessages((prev) => [
          ...prev,
          { id: "d2", role: "assistant", parts: [] },
        ]);
        await sleep(800, signal);

        // Tool 1: search
        setMessages((prev) =>
          prev.map((m) =>
            m.id === "d2"
              ? {
                  ...m,
                  parts: [
                    toolPart(
                      "web_search",
                      undefined,
                      "tc-research-search",
                      "input-available",
                      {
                        query:
                          "HYPE Hyperliquid narrative unlocks volume CT research",
                      },
                    ),
                  ],
                }
              : m,
          ),
        );
        await sleep(2200, signal);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === "d2"
              ? {
                  ...m,
                  parts: [
                    toolPart(
                      "web_search",
                      { results: SEARCH_HITS },
                      "tc-research-search",
                      "output-available",
                      {
                        query:
                          "HYPE Hyperliquid narrative unlocks volume CT research",
                      },
                    ),
                  ],
                }
              : m,
          ),
        );
        await sleep(1400, signal);

        // Tool 2: live price
        setMessages((prev) =>
          prev.map((m) =>
            m.id === "d2"
              ? {
                  ...m,
                  parts: [
                    ...m.parts,
                    toolPart(
                      "get_price_history",
                      undefined,
                      "tc-research-ohlc",
                      "input-available",
                      { coin: "hyperliquid", days: 90 },
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
        const closes = bars.map((b) => b.close);
        const last = closes[closes.length - 1]!;
        const first = closes[0]!;
        setSeries(closes);

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
          asOf: data.asOf,
        };

        await sleep(2000, signal);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === "d2"
              ? {
                  ...m,
                  parts: m.parts.map((p) =>
                    "toolCallId" in p &&
                    (p as { toolCallId?: string }).toolCallId ===
                      "tc-research-ohlc"
                      ? toolPart(
                          "get_price_history",
                          priceSeries,
                          "tc-research-ohlc",
                          "output-available",
                          { coin: "hyperliquid", days: 90 },
                        )
                      : p,
                  ),
                }
              : m,
          ),
        );
        await sleep(1600, signal);

        // Tool 3: synthesize research
        setMessages((prev) =>
          prev.map((m) =>
            m.id === "d2"
              ? {
                  ...m,
                  parts: [
                    ...m.parts,
                    toolPart(
                      "synthesize_research",
                      undefined,
                      "tc-research-synth",
                      "input-available",
                      {
                        symbol: "HYPE",
                        lenses: ["narrative", "fundamentals", "risks", "vs_uni"],
                      },
                    ),
                  ],
                }
              : m,
          ),
        );

        const research = buildResearchSnapshot(bars);
        setSnap(research);
        await sleep(2800, signal);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === "d2"
              ? {
                  ...m,
                  parts: m.parts.map((p) =>
                    "toolCallId" in p &&
                    (p as { toolCallId?: string }).toolCallId ===
                      "tc-research-synth"
                      ? toolPart(
                          "synthesize_research",
                          research,
                          "tc-research-synth",
                          "output-available",
                          {
                            symbol: "HYPE",
                            lenses: [
                              "narrative",
                              "fundamentals",
                              "risks",
                              "vs_uni",
                            ],
                          },
                        )
                      : p,
                  ),
                }
              : m,
          ),
        );

        const writeup = buildResearchWriteup(research);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === "d2"
              ? {
                  ...m,
                  parts: [...m.parts, { type: "text", text: "" }],
                }
              : m,
          ),
        );
        await sleep(700, signal);
        await typeHuman(writeup, {
          signal,
          typoRate: 0.018,
          speed: 2.4,
          onUpdate: (text) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== "d2") return m;
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

        setBusy(false);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "Research session failed",
        );
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
          Token / market research
        </h1>
        <p className="mt-0.5 text-[11px] text-zinc-600">
          Live tape plus street sources. Desk brief, then a plain annotated
          read.
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
              series={series}
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

export function isResearchLiveChat(chatId: string) {
  return chatId === RESEARCH_CHAT_ID;
}
