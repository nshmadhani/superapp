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
        textPart(
          "**HYPE - wide-angle research**\n\n### Narrative (Twitter / CT)\n- **Bulls:** Still the perps volume leader; “CEX killer” memes keep attention. Fee share / buyback chatter whenever volume prints hot.\n- **Bears:** Unlock calendar anxiety, competitor launches, and “what if OI migrates” threads every quiet week.\n- Sentiment is **loud but not one-sided** - good for trading attention, noisy for long-hold conviction.\n\n### Fundamentals / market structure\n- Product is the venue; HYPE is tied to **usage + staking / gas** more than a classic app-token flywheel.\n- Public dashboards still show **strong volume / OI** vs peers; that’s the core bull case.\n- Float and unlock pacing matter more than any single tweet - check Messari/unlock calendars before sizing.\n\n### Governance / DAO\n- Not a busy on-chain DAO like UNI/ARB. Expect **core-driven** roadmap; treat “governance alpha” as thin.\n\n### Risk flags\n1. Unlock / distribution overhang\n2. Venue concentration / regulatory headlines\n3. Narrative rotation if volume cools\n\n### Bottom line\nTrade it as a **high-beta venue token** with social amplification - not a quiet compounder. Want me to dig next into unlocks, competitor fee wars, or a wallet-sized risk brief?",
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
        textPart(
          "**HYPE vs UNI - research contrast**\n\n| | HYPE | UNI |\n|---|---|---|\n| Social | High velocity CT, drama cycles | Slower, governance-forum heavy |\n| Catalyst style | Volume prints, unlocks, memes | Fee switch / DAO votes |\n| Info diet | Twitter + dashboards | Forum + Tally + longform |\n| Holder job | Survive narrative whiplash | Track slow political process |\n\nRecent **Twitter drama** around HYPE clusters on unlocks and “is volume real / sticky.” UNI drama is quieter and procedural (fee switch pacing).\n\nI can keep this as a living brief - say the word and I’ll refresh social + gov sources anytime.",
        ),
      ]),
    ],
  },
  {
    id: "e8c14f57-2a9b-4e60-8d3c-5f1a7b0e9264",
    title: "Technical analysis",
    playback: true,
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
          },
          "tc-ohlcv",
          {
            symbol: "HYPE",
            timeframe: "1D",
            lookbackDays: 90,
            fields: ["open", "high", "low", "close", "volume"],
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
          "**HYPE · daily technical analysis**\n\nPulled **90d OHLCV** ($17.9-$32.4), checked funding/OI context, then scored structure + momentum.\n\n### 1. Market structure\nOff the ~**$32.4** spike, price is printing **lower highs and lower lows**. Swing highs stepped down through ~30.2 → 27.8 → 24.9 → failed holds of the mid-20s. That is an active **downtrend**, not a sideways base yet.\n\n### 2. Trend filter (EMAs)\n**EMA20 (~$23.4)** and **EMA50 (~$25.8)** both slope down; spot (**$20.8**) trades **below both**. Until a daily close reclaims and holds the 20, trend bias stays bearish.\n\n### 3. Support / resistance\n| Zone | Level | Role |\n|---|---|---|\n| R1 | **$24.0** | Last breakdown shelf / short trigger |\n| R2 | **$27.8** | Prior congestion |\n| R3 / invalidate | **$30.2** | Break of bearish structure |\n| S1 | **$20.8** | Current demand test |\n| S2-S3 | **$19.1 → $17.9** | Prior base / 90d low pocket |\n\n### 4. Momentum (RSI 14)\n**RSI ≈ 41** - cooled from the spike, **not washed-out** (<30). Sellers still have room; this is not a forced long on “oversold.” No clear bullish divergence on the latest lower low.\n\n### 5. Volume context\nLast prints run **~31% below** the 20d average on bounce attempts. Weak volume on relief rallies = **low conviction shorts covering / weak bids**, which usually favors continuation lower over a V-reversal.\n\n### 6. Short thesis - still valid?\n**Yes, but don’t chase into S1.** Prefer a **fade into $22.8-24.0** (failed reclaim of the breakdown shelf) rather than market-selling the support tap.\n\n- **Entry:** weak bounce / rejection in **$22.8-24.0**\n- **Stop:** above **$27.8** (tactical) or **$30.2** (structure invalidation)\n- **Targets:** **$19.1**, stretch **$17.9**\n- **Risk:** if funding flips deeply negative and OI expands on a reclaim of $24 with rising volume, stand down - that would be a change of character, not this tape.\n\n**Bottom line:** Bias remains **short-on-weakness**. Structure, EMAs, and volume agree; RSI says the move isn’t exhausted yet. Invalidation is a sustained reclaim through **$30.2**, not a single wick.\n\nWant the same framework on the **4H** for timing, or a second token?",
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
      "Every Monday buy $150 of ETH. Keep it automated. Base only. Skip a week if ETH is up more than 12% week-over-week. Later: also skip when gas is stupid.",
    agentWallet: {
      label: "DCA agent wallet",
      address: ADDR_DCA_AGENT,
      chainFamily: "evm",
    },
    guardRails: [
      { label: "Max per buy", value: "$150 USDC" },
      { label: "Momentum skip", value: "ETH WoW > +12%" },
      { label: "Gas skip", value: "Base gas too high" },
      { label: "Cadence", value: "Weekly · Mondays" },
    ],
    allowedChains: ["Base"],
    chatId: "1a6d9e82-4f0c-48b5-9c27-3e5d8a1f7049",
    activity: [
      {
        id: "r1",
        at: "2026-07-20T14:00:12Z",
        status: "done",
        title: "Bought 0.038 ETH",
        detail: "From agent wallet · $149.92",
      },
      {
        id: "r2",
        at: "2026-07-13T14:00:09Z",
        status: "done",
        title: "Bought 0.041 ETH",
        detail: "From agent wallet · $150.00",
      },
      {
        id: "r3",
        at: "2026-07-06T14:00:11Z",
        status: "skipped",
        title: "Skipped - momentum guard rail",
        detail: "ETH +14.2% WoW",
      },
      {
        id: "r4",
        at: "2026-06-29T14:00:08Z",
        status: "done",
        title: "Bought 0.036 ETH",
        detail: "From agent wallet · $149.88",
      },
      {
        id: "r5",
        at: "2026-07-27T14:00:00Z",
        status: "scheduled",
        title: "Next buy queued",
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
