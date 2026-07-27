import type { UIMessage } from "ai";

export type DemoChat = {
  id: string;
  title: string;
  messages: UIMessage[];
  /** Optional link from an agent control panel */
  linkedAgentId?: string;
  /** When true, DemoChatPanel plays messages as a live agent run */
  playback?: boolean;
};

export type DemoAgentActivity = {
  id: string;
  at: string;
  status: "done" | "running" | "scheduled" | "skipped";
  title: string;
  detail: string;
};

export type DemoAgent = {
  id: string;
  title: string;
  kind: "dca";
  status: "active" | "paused" | "completed";
  askedTo: string;
  /** Agent’s own dedicated wallet */
  agentWallet: {
    label: string;
    address: string;
    chainFamily: "evm" | "solana";
  };
  guardRails: Array<{ label: string; value: string }>;
  allowedChains: string[];
  activity: DemoAgentActivity[];
  /** Matching chat to instruct / update guard rails */
  chatId: string;
};

export type DemoPosition = {
  symbol: string;
  name: string;
  quantity: string;
  valueUsd: number;
  chainId: string;
  walletId: string;
  walletLabel: string;
  walletAddress: string;
};

export type DemoWallet = {
  walletId: string;
  address: string;
  label: string;
  chainFamily: "evm" | "solana";
  source: string;
  totalValueUsd: number;
  positions: DemoPosition[];
};

function toolPart(
  toolName: string,
  output: unknown,
  toolCallId: string,
  input: unknown = {},
): UIMessage["parts"][number] {
  return {
    type: `tool-${toolName}`,
    toolCallId,
    state: "output-available",
    input,
    output,
  } as UIMessage["parts"][number];
}

function textPart(text: string): UIMessage["parts"][number] {
  return { type: "text", text };
}

function userMsg(id: string, text: string): UIMessage {
  return { id, role: "user", parts: [textPart(text)] };
}

function assistantMsg(id: string, parts: UIMessage["parts"]): UIMessage {
  return { id, role: "assistant", parts };
}

const ADDR_TRADING = "0xA1b2c3d4e5f6789012345678901234567890abcd";
const ADDR_SOL = "7nYxK9mPqR2vL8wT4cB6hJ1sF3dA5gU0eZxWkP2";
const ADDR_DCA_AGENT = "0xDCA01a2b3c4d5e6f78901234567890abcdef01";

const kaminoPlanDone = {
  type: "multi_step_plan" as const,
  summary: "Get 0.4 ETH from Base into a Kamino vault on Solana",
  walletsUsed: [
    {
      label: "Trading",
      address: ADDR_TRADING,
      role: "Source · LI.FI route off Base",
    },
    {
      label: "Solana",
      address: ADDR_SOL,
      role: "Receive + deposit into Kamino",
    },
  ],
  legs: [
    {
      id: "leg-lifi",
      action: "bridge" as const,
      title: "0.4 ETH on Base → Solana via LI.FI",
      detail:
        "One LI.FI route - swap + bridge in a single source tx from Trading",
      walletLabel: "Trading",
      walletAddress: ADDR_TRADING,
      chainLabel: "Base → Solana",
      txHash: "0x8f3a91c2e7b04d1a6e55c0b9f2d8471e3a0c5b6d",
    },
    {
      id: "leg-vault",
      action: "deposit" as const,
      title: "Deposit into Kamino vault",
      detail: "Vault deposit from Solana wallet - live position",
      walletLabel: "Solana",
      walletAddress: ADDR_SOL,
      chainLabel: "Solana",
      txHash: "5Kq7mN2pR8sT1uV4wX6yZ0aB3cD9eF1gH2iJ4kL",
    },
  ],
};

const hypeSeries = [
  18.2, 18.6, 19.1, 18.4, 17.9, 18.8, 19.4, 20.1, 19.6, 21.0, 22.4, 21.8, 23.1,
  24.0, 23.2, 22.1, 21.5, 22.8, 24.6, 25.9, 25.1, 26.4, 27.8, 26.9, 28.2, 29.1,
  27.4, 26.0, 24.8, 25.6, 27.0, 28.5, 30.2, 29.4, 31.0, 32.4, 31.1, 29.8, 28.2,
  27.0, 28.6, 30.1, 29.2, 27.8, 26.4, 25.1, 24.0, 24.8, 26.2, 25.4, 24.1, 23.0,
  22.2, 23.5, 24.9, 24.2, 23.1, 22.0, 21.4, 20.8,
];

export const DEMO_CHATS: DemoChat[] = [
  {
    id: "7f3a2c91-8b4e-4d16-9e0a-1c5f8d2b6a40",
    title: "Swap · Bridge · Lend",
    messages: [
      userMsg(
        "u1",
        "I want to put 0.4 ETH into a Kamino vault. Can you do it for me?",
      ),
      assistantMsg("a1", [
        toolPart(
          "list_wallets",
          {
            wallets: [
              {
                id: "w-trading",
                label: "Trading",
                address: "0xA1b2…abcd",
                chainFamily: "evm",
              },
              {
                id: "w-sol",
                label: "Solana",
                address: "7nYx…kP2",
                chainFamily: "solana",
              },
              {
                id: "w-vault",
                label: "Vault",
                address: "0xBBcc…ccdd",
                chainFamily: "evm",
              },
            ],
          },
          "tc-wallets-1",
        ),
        toolPart(
          "get_portfolio",
          {
            type: "portfolio_overview",
            totalValueUsd: 52640.95,
            positions: [
              {
                symbol: "ETH",
                name: "Ether",
                quantity: "2.14",
                valueUsd: 8420.1,
                walletLabel: "Trading",
              },
              {
                symbol: "ETH",
                name: "Ether",
                quantity: "4.00",
                valueUsd: 15760,
                walletLabel: "Vault",
              },
              {
                symbol: "SOL",
                name: "Solana",
                quantity: "32.5",
                valueUsd: 5200,
                walletLabel: "Solana",
              },
            ],
            wallets: [
              {
                walletId: "w-trading",
                label: "Trading",
                totalValueUsd: 18420.55,
                chainFamily: "evm",
              },
              {
                walletId: "w-sol",
                label: "Solana",
                totalValueUsd: 9120.4,
                chainFamily: "solana",
              },
              {
                walletId: "w-vault",
                label: "Vault",
                totalValueUsd: 25100,
                chainFamily: "evm",
              },
            ],
          },
          "tc-pf-1",
        ),
        toolPart(
          "ask_user",
          {
            type: "clarification",
            question:
              "Kamino lives on Solana - which wallets should I use? I’ll pull ETH from one side and deposit from a Solana wallet.",
            options: [
              "Trading (ETH) + Solana (vault)",
              "Vault (ETH) + Solana (vault)",
              "Let me pick differently",
            ],
          },
          "tc-ask-wallets",
        ),
        textPart(
          "You’ve got ETH on **Trading** and **Vault**, and a **Solana** wallet ready for Kamino. Tell me which pairing to use - I’ll route through LI.FI and deposit into the vault.",
        ),
      ]),
      userMsg("u2", "Trading (ETH) + Solana (vault)"),
      assistantMsg("a2", [
        toolPart(
          "get_yields",
          {
            pools: [
              {
                project: "kamino",
                symbol: "USDC",
                chain: "Solana",
                apy: 5.4,
                tvlUsd: 890_000_000,
              },
              {
                project: "kamino",
                symbol: "SOL",
                chain: "Solana",
                apy: 7.1,
                tvlUsd: 410_000_000,
              },
            ],
          },
          "tc-yields",
        ),
        toolPart("create_plan", kaminoPlanDone, "tc-kamino-plan"),
        toolPart(
          "execute_plan",
          {
            type: "multi_step_execution",
            planId: "demo-kamino",
            status: "completed",
            legsCompleted: 2,
          },
          "tc-exec",
        ),
        textPart(
          "Done - **0.4 ETH** is in the Kamino vault.\n\n**Trading** signed one **LI.FI** route (Base → Solana). **Solana** signed the vault deposit. Plan below.",
        ),
      ]),
    ],
  },
  {
    id: "b2e91d04-6c7a-4f83-a1d5-9e8c3b0f4712",
    title: "Token / market research",
    messages: [
      userMsg(
        "d1",
        "Give me a full read on HYPE - not just governance. What’s the street saying, what’s moving price, any risk flags?",
      ),
      assistantMsg("d2", [
        toolPart(
          "get_price_history",
          {
            type: "price_series",
            symbol: "HYPE",
            timeframe: "1D",
            lookbackDays: 90,
            source: "CoinGecko market_chart",
            candleCount: 91,
            series: hypeSeries,
            last: 20.8,
            changePct: -8.4,
            high90: 32.4,
            low90: 17.9,
          },
          "tc-research-price",
          {
            coin: "hyperliquid",
            source: "coingecko",
            timeframe: "1D",
            lookbackDays: 90,
          },
        ),
        toolPart(
          "web_search",
          {
            results: [
              {
                title: "Hyperliquid - protocol overview",
                url: "https://hyperliquid.xyz/",
                content: "L1 perps venue · HYPE as gas / staking asset.",
              },
              {
                title: "Messari - HYPE research",
                url: "https://messari.io/report/hyperliquid",
                content:
                  "Token unlock schedule, float, and competitive positioning vs CEX perps.",
              },
              {
                title: "DefiLlama - Hyperliquid TVL & volume",
                url: "https://defillama.com/protocol/hyperliquid",
                content: "Open interest and fee trends over the last quarter.",
              },
              {
                title: "X / Twitter - @HyperliquidX & CT thread digest",
                url: "https://x.com/search?q=HYPE%20Hyperliquid",
                content:
                  "CT split: bulls on volume leadership; bears on unlock overhang and copycat venues.",
              },
              {
                title: "Governance / forum notes",
                url: "https://gov.hyperliquid.community/",
                content:
                  "Sparse formal DAO surface; most decisions still core-team led.",
              },
            ],
          },
          "tc-research-hype",
        ),
        toolPart(
          "synthesize_research",
          {
            type: "research_snapshot",
            symbol: "HYPE",
            last: 20.8,
            changePct90: -8.4,
            high90: 32.4,
            low90: 17.9,
            narrative:
              "Volume leadership keeps bulls engaged, but unlock chatter and copycat-venue fear keep conviction split.",
            sentiment: "High attention, split conviction",
            thesis: "High-beta venue token, not a quiet compounder",
            risks: [
              "Unlock / distribution overhang",
              "Venue concentration / regulatory headlines",
              "Narrative rotation if volume cools",
            ],
            vsQuietBluechip:
              "Vs UNI, HYPE trades on CT velocity and venue stats, while UNI trades on slower fee-switch and governance process.",
            scores: {
              attention: 9,
              unlockRisk: 7,
              volumeStrength: 8,
              governanceSignal: 3,
            },
          },
          "tc-research-synth",
          {
            lenses: [
              "social narrative",
              "venue fundamentals",
              "unlock risk",
              "bluechip comparison",
            ],
            note: "Blend market tape with CT and governance sources",
          },
        ),
        textPart(
          "**HYPE - wide-angle research**\n\nI pulled **90 daily closes from CoinGecko**, checked the core protocol / market sources, then stitched that together with the current CT loop.\n\n### What the street is actually trading\n- **Bulls:** still see Hyperliquid as the cleanest \"CEX killer\" meme in market structure terms. When volume or fee prints look strong, CT immediately jumps back to buyback / fee-share style speculation.\n- **Bears:** keep hammering the same three things: unlock overhang, venue concentration, and whether competitors can chip away at the attention premium.\n- Net result: attention is **high**, but conviction is **split**. That matters because HYPE trades more like a narrative-vol asset than a sleepy governance token.\n\n### What is moving price\n1. **Venue usage**: volume, fees, and open-interest chatter matter more than governance threads.\n2. **Unlock calendar**: large-transfer screenshots and float concerns can hit sentiment fast.\n3. **Narrative leadership**: if Hyperliquid still feels like the dominant venue story, HYPE gets bid harder than slower DeFi bluechips.\n4. **General risk mood**: when perps traders de-risk, HYPE usually feels it faster than a slower token like UNI.\n\n### Fundamentals / structure\n- The product is the venue. HYPE is tied to **usage + staking / gas**, not a classic app-token flywheel.\n- Public dashboards still show **strong volume / OI** relative to peers. That is the core bull case.\n- The live tape in this chat shows the token is still far below the **~$32.4** 90d high, which is why every bounce gets argued as either \"re-rating\" or just another attention reflex.\n\n### Governance / DAO\n- This is not a busy on-chain DAO like UNI or ARB.\n- Expect a more **core-driven** roadmap and thinner governance alpha.\n- If you are long, you are mostly underwriting venue relevance, not proposal flow.\n\n### Bottom line\nTrade it as a **high-beta venue token** with social amplification. Good if you want attention and catalyst velocity. Bad if you want a quiet compounder with clean long-duration governance cashflow.",
        ),
      ]),
      userMsg(
        "d3",
        "Yeah - pull more from Twitter and any recent drama, then compare to a quieter bluechip like UNI.",
      ),
      assistantMsg("d4", [
        toolPart(
          "web_search",
          {
            results: [
              {
                title: "CT recap - HYPE unlock discourse (this week)",
                url: "https://x.com/search?q=HYPE%20unlock",
                content:
                  "Recurring unlock FUD vs “already priced” counters; engagement spikes on large transfers.",
              },
              {
                title: "Uniswap governance - fee switch temperature",
                url: "https://gov.uniswap.org/",
                content:
                  "Slower, formal process; fee switch still the macro UNI narrative.",
              },
              {
                title: "CoinDesk / The Block - Hyperliquid coverage",
                url: "https://www.coindesk.com/tag/hyperliquid/",
                content:
                  "Press focuses on volume records and competitive pressure on CEXs.",
              },
            ],
          },
          "tc-research-compare",
        ),
        toolPart(
          "synthesize_research",
          {
            type: "research_snapshot",
            symbol: "HYPE",
            last: 20.8,
            changePct90: -8.4,
            high90: 32.4,
            low90: 17.9,
            narrative:
              "Unlock talk and volume-quality debate dominate CT, while UNI discussion stays slower and procedural.",
            sentiment: "Drama-heavy HYPE vs process-heavy UNI",
            thesis: "HYPE is a faster narrative trade than UNI",
            risks: [
              "Unlock headlines can reset sentiment intraday",
              "If venue stats flatten, narrative premium compresses",
              "CT can overreact to transfer screenshots",
            ],
            vsQuietBluechip:
              "UNI holders track fee-switch and governance timing; HYPE holders track venue stats, sentiment velocity, and unlock chatter.",
            scores: {
              attention: 9,
              unlockRisk: 7,
              volumeStrength: 8,
              governanceSignal: 3,
            },
          },
          "tc-research-contrast",
          {
            compare: ["HYPE", "UNI"],
            focus: ["social tempo", "catalysts", "holder workload"],
          },
        ),
        textPart(
          "**HYPE vs UNI - research contrast**\n\n| | HYPE | UNI |\n|---|---|---|\n| Social tempo | High velocity CT, drama cycles | Slower, governance-forum heavy |\n| What moves price | Volume prints, unlocks, memes | Fee switch, DAO votes, longform policy debate |\n| Info diet | Twitter + dashboards + venue metrics | Forum + Tally + longform research |\n| Holder job | Survive narrative whiplash | Track slower political process |\n\nIf you own **HYPE**, your workload is basically checking whether the venue is still the hottest object in the room. If you own **UNI**, your workload is slower and more procedural. The current CT drama around HYPE is still the same loop: unlock screenshots, \"is volume sticky,\" and whether the venue can stay culturally dominant.\n\nThat makes HYPE more exciting, but also much more fragile to sentiment air pockets. I can keep this as a living brief if you want unlock dates, competitor fee wars, or a tighter risk memo next.",
        ),
      ]),
    ],
  },
  {
    id: "e8c14f57-2a9b-4e60-8d3c-5f1a7b0e9264",
    title: "Technical analysis",
    messages: [
      userMsg(
        "t1",
        "Run a proper TA pass on HYPE - daily OHLCV, structure, levels, momentum, and tell me if a short still makes sense from here.",
      ),
      assistantMsg("t2", [
        toolPart(
          "get_price_history",
          {
            type: "price_series",
            symbol: "HYPE",
            timeframe: "1D",
            lookbackDays: 90,
            series: hypeSeries,
            last: 20.8,
            changePct: -8.4,
            high90: 32.4,
            low90: 17.9,
            rangePct: 80.9,
            avgVolume20d: "142M",
            lastVolume: "98M",
            source: "CoinGecko market_chart",
            candleCount: 91,
          },
          "tc-ohlcv",
          {
            symbol: "HYPE",
            timeframe: "1D",
            lookbackDays: 90,
            source: "coingecko",
            fields: ["open", "high", "low", "close", "volume"],
          },
        ),
        toolPart(
          "run_ta_script",
          {
            type: "script_run",
            script: "hype_daily_ta.py",
            runtime: "python3",
            inputs: ["91 daily OHLCV candles", "1D timeframe", "HYPE"],
            computed: [
              "market structure",
              "EMA20 / EMA50 trend",
              "RSI14",
              "support / resistance ladder",
              "volume vs 20d average",
            ],
            summary:
              "Code confirmed lower highs, lower lows, price below both moving averages, and weak bounce volume.",
          },
          "tc-ta-script",
          {
            note: "Execute quant summary code over fetched candle set",
          },
        ),
        toolPart(
          "web_search",
          {
            results: [
              {
                title: "HYPEUSD - TradingView daily",
                url: "https://www.tradingview.com/symbols/HYPEUSD/",
                content:
                  "Daily chart: failed reclaim of mid-20s shelf; volume fading on relief rallies.",
              },
              {
                title: "CoinGlass - HYPE funding & open interest",
                url: "https://www.coinglass.com/",
                content:
                  "Perp funding elevated on prior bounce attempts; OI not expanding into the grind lower.",
              },
              {
                title: "CoinGecko - Hyperliquid (HYPE)",
                url: "https://www.coingecko.com/en/coins/hyperliquid",
                content: "Spot reference · 90d high near $32, trading ~$21.",
              },
            ],
          },
          "tc-ta-search",
          { query: "HYPE USD daily structure funding open interest volume" },
        ),
        toolPart(
          "analyze_technicals",
          {
            type: "ta_snapshot",
            symbol: "HYPE",
            timeframe: "1D",
            structure: "Lower highs / lower lows (downtrend)",
            bias: "Short on weakness",
            indicators: {
              rsi14: 41.2,
              ema20: 23.4,
              ema50: 25.8,
              atr14: 1.65,
            },
            levels: {
              resistance: [24.0, 27.8, 30.2],
              support: [20.8, 19.1, 17.9],
              invalidation: 30.2,
            },
            volume: {
              note: "Relief rallies print below 20d avg - weak participation",
              vs20dAvg: "−31%",
            },
            risk: {
              entryZone: "$22.8-24.0 fade",
              stop: "above $27.8 (tight) or $30.2 (structure)",
              targets: "$19.1 then $17.9",
              rr: "~1.8-2.4R from mid fade",
            },
          },
          "tc-ta-analyze",
          {
            symbol: "HYPE",
            timeframe: "1D",
            methods: [
              "market_structure",
              "support_resistance",
              "ema_trend",
              "rsi14",
              "volume_context",
              "risk_framing",
            ],
          },
        ),
        textPart(
          "**HYPE · daily technical analysis**\n\nI fetched **91 daily candles from CoinGecko**, ran a quick quant script over the set, then sanity-checked the read against funding / OI context.\n\n### 1. Market structure\nOff the ~**$32.4** spike, price is still printing **lower highs and lower lows**. The failed reclaim sequence through the mid-20s matters more than any one intraday bounce. Structurally this still looks like an active downtrend, not a base.\n\n### 2. Trend filter (EMAs)\n**EMA20 (~$23.4)** and **EMA50 (~$25.8)** both slope down; spot (**$20.8**) is **below both**. Until daily closes reclaim and hold that moving-average cluster, any bounce has to prove itself.\n\n### 3. Levels that matter\n| Zone | Level | Role |\n|---|---|---|\n| R1 | **$24.0** | Last breakdown shelf / first fade zone |\n| R2 | **$27.8** | Prior congestion / tactical stop zone |\n| R3 | **$30.2** | Real structure invalidation |\n| S1 | **$20.8** | Current demand test |\n| S2-S3 | **$19.1 → $17.9** | Prior base / 90d low pocket |\n\n### 4. Momentum + volume\n**RSI ≈ 41** says the move is softer than the first breakdown wave, but not exhausted. More important: rally attempts are still printing **below the 20d average**. Weak bounce volume usually means the path of least resistance is still lower until proven otherwise.\n\n### 5. Trade framing\nThe short still makes sense, but **not as a panic sell into support**. The better version is letting price bounce into the failed shelf and seeing if sellers reappear.\n\n- **Better trigger:** rejection in **$22.8-24.0**\n- **Tactical stop:** above **$27.8**\n- **True invalidation:** sustained reclaim through **$30.2**\n- **Downside map:** **$19.1** first, then **$17.9** if risk stays off\n\n**Bottom line:** still a **short-on-weakness / fade-strength** chart. Structure, EMA trend, and volume all line up. I would only back off if price reclaims the mid-20s with real participation, not just one squeeze candle.",
        ),
      ]),
      userMsg(
        "t3",
        "What would make you stop leaning short here and say the trade is dead?",
      ),
      assistantMsg("t4", [
        textPart(
          "Three things would make me stop pressing the short:\n\n1. **Daily reclaim of $24-25 with real volume**. I want to see spot back above the breakdown shelf and the bounce participation improve, not just a thin squeeze.\n2. **EMA20 flattening / price accepting above it**. If price starts living back above the 20 and the 50 is no longer capping every rally, the tape is changing.\n3. **Structure invalidation through ~$30.2**. That is the clean line in the sand. Above that, the lower-high sequence is broken and the thesis is no longer the same trade.\n\nSo the tactical answer is \"be careful above $27.8.\" The real answer is \"the bearish idea is wrong above $30.2 with acceptance.\"",
        ),
      ]),
    ],
  },
  {
    id: "1a6d9e82-4f0c-48b5-9c27-3e5d8a1f7049",
    title: "DCA agent",
    linkedAgentId: "c0a8e3f1-5d2b-4a97-8e16-7b4c9d0a2f58",
    messages: [
      userMsg(
        "c1",
        "Set up a weekly DCA - about $150 of ETH, keep it boring and automated.",
      ),
      assistantMsg("c2", [
        toolPart(
          "ask_user",
          {
            type: "clarification",
            question: "Any hard rules for this agent?",
            options: [
              "Base only · skip if ETH +12% WoW",
              "Base + Arbitrum · no skip rule",
              "I’ll write custom guard rails",
            ],
          },
          "tc-dca-ask",
        ),
        textPart(
          "I can spin an autonomous DCA with its **own agent wallet**. You message here to change size, cadence, or guard rails anytime.",
        ),
      ]),
      userMsg("c3", "Base only · skip if ETH +12% WoW"),
      assistantMsg("c4", [
        textPart(
          "Locked in.\n\n- **Agent wallet:** `0xDCA0…ef01` (dedicated)\n- **Guard rails:** max $150/buy · skip if ETH WoW > +12%\n- **Allowed chains:** Base\n\nIt’s running - open the **DCA** agent panel for activity, or keep chatting here to tweak rules.",
        ),
      ]),
      userMsg("c5", "Also don’t buy if gas is stupid - add that guard rail."),
      assistantMsg("c6", [
        textPart(
          "Added: **skip when Base gas > 0.4 gwei effective** for the buy path. Activity log will show skips when that fires.",
        ),
      ]),
    ],
  },
];

export const DEMO_AGENTS: DemoAgent[] = [
  {
    id: "c0a8e3f1-5d2b-4a97-8e16-7b4c9d0a2f58",
    title: "DCA",
    kind: "dca",
    status: "active",
    askedTo:
      "Keep buying ETH on a boring weekly schedule, from this agent's own wallet, with clear spend and risk limits.",
    agentWallet: {
      label: "Agent wallet",
      address: ADDR_DCA_AGENT,
      chainFamily: "evm",
    },
    guardRails: [
      { label: "Spend limit", value: "$150 per run" },
      { label: "Schedule", value: "Weekly · Mondays" },
      { label: "Risk rule", value: "Skip if asset up >12% WoW" },
      { label: "Gas policy", value: "Skip when network fees are high" },
    ],
    allowedChains: ["Base"],
    chatId: "1a6d9e82-4f0c-48b5-9c27-3e5d8a1f7049",
    activity: [
      {
        id: "r1",
        at: "2026-07-20T14:00:12Z",
        status: "done",
        title: "Run completed",
        detail: "Agent wallet spent $149.92 · ETH buy",
      },
      {
        id: "r2",
        at: "2026-07-13T14:00:09Z",
        status: "done",
        title: "Run completed",
        detail: "Agent wallet spent $150.00 · ETH buy",
      },
      {
        id: "r3",
        at: "2026-07-06T14:00:11Z",
        status: "skipped",
        title: "Skipped by risk rule",
        detail: "Asset was up 14.2% week over week",
      },
      {
        id: "r4",
        at: "2026-06-29T14:00:08Z",
        status: "done",
        title: "Run completed",
        detail: "Agent wallet spent $149.88 · ETH buy",
      },
      {
        id: "r5",
        at: "2026-07-27T14:00:00Z",
        status: "scheduled",
        title: "Next run queued",
        detail: "Monday · agent wallet funded",
      },
    ],
  },
];

export const DEMO_WALLETS: DemoWallet[] = [
  {
    walletId: "w-trading",
    address: ADDR_TRADING,
    label: "Trading",
    chainFamily: "evm",
    source: "turnkey",
    totalValueUsd: 18420.55,
    positions: [
      {
        symbol: "ETH",
        name: "Ether",
        quantity: "2.14",
        valueUsd: 8420.1,
        chainId: "base",
        walletId: "w-trading",
        walletLabel: "Trading",
        walletAddress: ADDR_TRADING,
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        quantity: "6200.00",
        valueUsd: 6200,
        chainId: "base",
        walletId: "w-trading",
        walletLabel: "Trading",
        walletAddress: ADDR_TRADING,
      },
      {
        symbol: "cbBTC",
        name: "Coinbase Wrapped BTC",
        quantity: "0.042",
        valueUsd: 3800.45,
        chainId: "base",
        walletId: "w-trading",
        walletLabel: "Trading",
        walletAddress: ADDR_TRADING,
      },
    ],
  },
  {
    walletId: "w-sol",
    address: ADDR_SOL,
    label: "Solana",
    chainFamily: "solana",
    source: "turnkey",
    totalValueUsd: 9120.4,
    positions: [
      {
        symbol: "SOL",
        name: "Solana",
        quantity: "32.5",
        valueUsd: 5200.0,
        chainId: "solana",
        walletId: "w-sol",
        walletLabel: "Solana",
        walletAddress: ADDR_SOL,
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        quantity: "2420.40",
        valueUsd: 2420.4,
        chainId: "solana",
        walletId: "w-sol",
        walletLabel: "Solana",
        walletAddress: ADDR_SOL,
      },
      {
        symbol: "JUP",
        name: "Jupiter",
        quantity: "1800",
        valueUsd: 1500.0,
        chainId: "solana",
        walletId: "w-sol",
        walletLabel: "Solana",
        walletAddress: ADDR_SOL,
      },
    ],
  },
  {
    walletId: "w-vault",
    address: "0xBBccDdEeFf0011223344556677889900aabbccdd",
    label: "Vault",
    chainFamily: "evm",
    source: "external",
    totalValueUsd: 25100.0,
    positions: [
      {
        symbol: "ETH",
        name: "Ether",
        quantity: "4.00",
        valueUsd: 15760.0,
        chainId: "ethereum",
        walletId: "w-vault",
        walletLabel: "Vault",
        walletAddress: "0xBBccDdEeFf0011223344556677889900aabbccdd",
      },
      {
        symbol: "aUSDC",
        name: "Aave USDC",
        quantity: "9340.00",
        valueUsd: 9340.0,
        chainId: "ethereum",
        walletId: "w-vault",
        walletLabel: "Vault",
        walletAddress: "0xBBccDdEeFf0011223344556677889900aabbccdd",
      },
    ],
  },
  {
    walletId: "w-dca-agent",
    address: ADDR_DCA_AGENT,
    label: "DCA agent",
    chainFamily: "evm",
    source: "turnkey",
    totalValueUsd: 842.5,
    positions: [
      {
        symbol: "USDC",
        name: "USD Coin",
        quantity: "620.00",
        valueUsd: 620,
        chainId: "base",
        walletId: "w-dca-agent",
        walletLabel: "DCA agent",
        walletAddress: ADDR_DCA_AGENT,
      },
      {
        symbol: "ETH",
        name: "Ether",
        quantity: "0.056",
        valueUsd: 222.5,
        chainId: "base",
        walletId: "w-dca-agent",
        walletLabel: "DCA agent",
        walletAddress: ADDR_DCA_AGENT,
      },
    ],
  },
];

export function getDemoChat(id: string): DemoChat | undefined {
  return DEMO_CHATS.find((c) => c.id === id);
}

export function getDemoAgent(id: string): DemoAgent | undefined {
  return DEMO_AGENTS.find((a) => a.id === id);
}

export function demoPortfolioOverview() {
  const positions = DEMO_WALLETS.flatMap((w) => w.positions);
  const totalValueUsd = DEMO_WALLETS.reduce((s, w) => s + w.totalValueUsd, 0);
  return {
    totalValueUsd,
    asOf: "2026-07-26T18:00:00.000Z",
    wallets: DEMO_WALLETS,
    positions: [...positions].sort(
      (a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0),
    ),
  };
}
