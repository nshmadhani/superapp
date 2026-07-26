import type { UIMessage } from "ai";

export type DemoChat = {
  id: string;
  title: string;
  messages: UIMessage[];
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
  kind: "dca" | "ta";
  status: "active" | "paused" | "completed";
  askedTo: string;
  brief: string;
  params: Array<{ label: string; value: string }>;
  activity: DemoAgentActivity[];
  /** TA-only chart series (close prices, oldest → newest) */
  series?: number[];
  signal?: {
    bias: "long" | "short" | "neutral";
    headline: string;
    levels: Array<{ label: string; value: string }>;
  };
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
): UIMessage["parts"][number] {
  return {
    type: `tool-${toolName}`,
    toolCallId,
    state: "output-available",
    input: {},
    output,
  } as UIMessage["parts"][number];
}

function textPart(text: string): UIMessage["parts"][number] {
  return { type: "text", text };
}

function userMsg(id: string, text: string): UIMessage {
  return { id, role: "user", parts: [textPart(text)] };
}

function assistantMsg(
  id: string,
  parts: UIMessage["parts"],
): UIMessage {
  return { id, role: "assistant", parts };
}

const ADDR_TRADING = "0xA1b2c3d4e5f6789012345678901234567890abcd";
const ADDR_SOL = "7nYxK9mPqR2vL8wT4cB6hJ1sF3dA5gU0eZxWkP2";

/** One saga: swap → bridge → lend, signed across Trading + Solana. */
const multiStepPlanReady = {
  type: "multi_step_plan" as const,
  summary:
    "Swap 0.4 ETH→USDC on Base, bridge 500 USDC to Solana, lend 500 USDC on Kamino",
  status: "ready" as const,
  legs: [
    {
      id: "leg-swap",
      action: "swap" as const,
      title: "Swap 0.4 ETH → ~1,042 USDC",
      detail: "LI.FI · Uniswap V3 on Base · 0.12% impact",
      walletLabel: "Trading",
      walletAddress: ADDR_TRADING,
      chainLabel: "Base",
      status: "awaiting_signature" as const,
    },
    {
      id: "leg-bridge",
      action: "bridge" as const,
      title: "Bridge 500 USDC Base → Solana",
      detail: "LI.FI · Allbridge · lands in Solana wallet · ~90s",
      walletLabel: "Trading",
      walletAddress: ADDR_TRADING,
      chainLabel: "Base → Solana",
      status: "pending" as const,
    },
    {
      id: "leg-lend",
      action: "lend" as const,
      title: "Lend 500 USDC on Kamino",
      detail: "Supply USDC → Kamino lend · ~5.4% APY · execute (not discovery)",
      walletLabel: "Solana",
      walletAddress: ADDR_SOL,
      chainLabel: "Solana",
      status: "pending" as const,
    },
  ],
};

const multiStepPlanDone = {
  ...multiStepPlanReady,
  status: "completed" as const,
  legs: [
    {
      ...multiStepPlanReady.legs[0]!,
      status: "done" as const,
      txHash: "0x8f3a91c2e7b04d1a6e55c0b9f2d8471e3a0c5b6d",
    },
    {
      ...multiStepPlanReady.legs[1]!,
      status: "done" as const,
      txHash: "0x2c1b0a9f8e7d6c5b4a3928170615243f0e1d2c3b",
    },
    {
      ...multiStepPlanReady.legs[2]!,
      status: "done" as const,
      txHash: "5Kq7mN2pR8sT1uV4wX6yZ0aB3cD9eF1gH2iJ4kL",
    },
  ],
};

export const DEMO_CHATS: DemoChat[] = [
  {
    id: "swap-bridge-lend",
    title: "Swap · Bridge · Lend",
    messages: [
      userMsg(
        "u1",
        "Swap 0.4 ETH to USDC on Base, bridge 500 USDC to my Solana wallet, then lend that USDC — one flow, I’ll sign whatever wallets you need.",
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
            ],
          },
          "tc-wallets-1",
        ),
        toolPart(
          "get_portfolio",
          {
            type: "portfolio_overview",
            totalValueUsd: 27540.95,
            positions: [
              {
                symbol: "ETH",
                name: "Ether",
                quantity: "2.14",
                valueUsd: 8420.1,
                walletLabel: "Trading",
              },
              {
                symbol: "USDC",
                name: "USD Coin",
                quantity: "6200.00",
                valueUsd: 6200,
                walletLabel: "Trading",
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
            ],
          },
          "tc-pf-1",
        ),
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
                project: "aave-v3",
                symbol: "USDC",
                chain: "Base",
                apy: 4.2,
                tvlUsd: 420_000_000,
              },
            ],
          },
          "tc-yields",
        ),
        toolPart("create_plan", multiStepPlanReady, "tc-multi-plan"),
        toolPart(
          "simulate_plan",
          {
            ok: true,
            warnings: [],
            summary:
              "3-leg saga simulated · swap+bridge on Trading · lend execute on Solana",
          },
          "tc-sim-multi",
        ),
        textPart(
          "One multi-step plan across **two wallets**:\n\n1. **Trading (Base)** signs the swap\n2. **Trading (Base)** signs the bridge out\n3. **Solana** signs the lend deposit on Kamino (full execute — not discovery)\n\nApprove the saga once; Cipher will prompt each wallet in order.",
        ),
      ]),
      userMsg("u2", "Looks good — run the whole thing."),
      assistantMsg("a2", [
        toolPart(
          "execute_plan",
          {
            type: "multi_step_execution",
            planId: "demo-plan-multi",
            status: "completed",
            legsCompleted: 3,
          },
          "tc-exec-multi",
        ),
        toolPart("create_plan", multiStepPlanDone, "tc-multi-done"),
        textPart(
          "All three legs executed.\n\n- Swap settled on Base (`0x8f3a…5b6d`) — **Trading**\n- Bridge completed Base→Solana (`0x2c1b…2c3b`) — **Trading** signed source\n- Lend live on Kamino (`5Kq7…kL`) — **Solana** signed supply\n\nYou’re earning on the bridged USDC. Dashboard reflects both wallets.",
        ),
      ]),
    ],
  },
  {
    id: "dao-research",
    title: "Token / DAO research",
    messages: [
      userMsg(
        "d1",
        "What’s going on with Uniswap governance right now? Any proposals that affect UNI holders this month?",
      ),
      assistantMsg("d2", [
        toolPart(
          "web_search",
          {
            results: [
              {
                title: "Uniswap Governance — Active Proposals",
                url: "https://www.tally.xyz/gov/uniswap",
                content:
                  "Several temperature checks and on-chain votes active around fee switch and grants.",
              },
              {
                title: "Uniswap Forum — Fee Switch Discussion",
                url: "https://gov.uniswap.org/",
                content:
                  "Community debate on activating protocol fees and UNI value accrual.",
              },
              {
                title: "Messari — UNI governance recap",
                url: "https://messari.io/report/uniswap",
                content:
                  "Summary of recent quorum dynamics and delegate concentration.",
              },
            ],
          },
          "tc-search-uni",
        ),
        textPart(
          "**Uniswap governance — this month’s pulse**\n\n1. **Fee switch** — Still the main thread. Forum temperature checks are warm; no final on-chain execution yet. If it lands, protocol fees could accrue toward UNI (details still contested).\n2. **Grants / accountability** — Active discussion on tighter reporting for funded teams.\n3. **Delegate map** — Voting power still concentrated; quorum risk on contentious votes.\n\nNothing that forces an immediate wallet action for a passive UNI holder, but fee-switch timing is the narrative to watch. Want a deeper dive on a specific proposal ID next?",
        ),
      ]),
      userMsg(
        "d3",
        "Compare that to Arbitrum DAO — any treasury or staking proposals I should know about?",
      ),
      assistantMsg("d4", [
        toolPart(
          "web_search",
          {
            results: [
              {
                title: "Arbitrum DAO — Proposals",
                url: "https://www.tally.xyz/gov/arbitrum",
                content:
                  "Treasury and staking-related proposals under discussion.",
              },
              {
                title: "Arbitrum Forum — Staking",
                url: "https://forum.arbitrum.foundation/",
                content:
                  "ARB staking design iterations and incentive programs.",
              },
            ],
          },
          "tc-search-arb",
        ),
        textPart(
          "**Arbitrum vs Uniswap (governance lens)**\n\n| | Uniswap | Arbitrum |\n|---|---|---|\n| Hot topic | Fee switch / value accrual | Treasury + staking design |\n| Holder impact | Indirect until fee switch ships | More direct via incentives / stake |\n| Tempo | Slower, high-stakes | Faster proposal cadence |\n\nIf you’re holding both: UNI is a **catalyst watch**; ARB is more about **participating in treasury/staking shape**. I can draft a one-page brief for either DAO next.",
        ),
      ]),
    ],
  },
];

export const DEMO_AGENTS: DemoAgent[] = [
  {
    id: "dca",
    title: "DCA",
    kind: "dca",
    status: "active",
    askedTo:
      "Every Monday buy $150 of ETH on Base from my Trading wallet using USDC. Keep running until I pause it. Prefer low slippage; skip a week if ETH is up >12% week-over-week.",
    brief:
      "Autonomous DCA is live. Cipher quotes via LI.FI, confirms under your standing policy (max $150/buy, Base only), and logs each run here.",
    params: [
      { label: "Asset", value: "ETH (Base)" },
      { label: "Amount", value: "$150 USDC / buy" },
      { label: "Cadence", value: "Weekly · Mondays 14:00 UTC" },
      { label: "Wallet", value: "Trading" },
      { label: "Guardrail", value: "Skip if ETH WoW > +12%" },
      { label: "Next run", value: "Mon · in 3 days" },
    ],
    activity: [
      {
        id: "r1",
        at: "2026-07-20T14:00:12Z",
        status: "done",
        title: "Bought 0.038 ETH",
        detail: "Spent 149.92 USDC · Uniswap V3 · impact 0.08%",
      },
      {
        id: "r2",
        at: "2026-07-13T14:00:09Z",
        status: "done",
        title: "Bought 0.041 ETH",
        detail: "Spent 150.00 USDC · route via LI.FI",
      },
      {
        id: "r3",
        at: "2026-07-06T14:00:11Z",
        status: "skipped",
        title: "Skipped — guardrail",
        detail: "ETH +14.2% WoW · policy skip",
      },
      {
        id: "r4",
        at: "2026-06-29T14:00:08Z",
        status: "done",
        title: "Bought 0.036 ETH",
        detail: "Spent 149.88 USDC · Base",
      },
      {
        id: "r5",
        at: "2026-07-27T14:00:00Z",
        status: "scheduled",
        title: "Next buy queued",
        detail: "Will quote & execute under standing policy",
      },
    ],
  },
  {
    id: "ta",
    title: "Technical analysis",
    kind: "ta",
    status: "active",
    askedTo:
      "Watch HYPE on a daily timeframe. Flag when structure looks shortable vs when I’d rather wait. Use our historical series plus public OHLCV; keep it actionable, not noisy.",
    brief:
      "TA agent keeps a live read on HYPE. Chart below is built from the fused series; signal updates when structure or momentum flips.",
    params: [
      { label: "Market", value: "HYPE / USD" },
      { label: "Timeframe", value: "1D" },
      { label: "Lookback", value: "90 days" },
      { label: "Data", value: "Public OHLCV + Cipher history" },
      { label: "Last refresh", value: "12 min ago" },
    ],
    series: [
      18.2, 18.6, 19.1, 18.4, 17.9, 18.8, 19.4, 20.1, 19.6, 21.0, 22.4, 21.8,
      23.1, 24.0, 23.2, 22.1, 21.5, 22.8, 24.6, 25.9, 25.1, 26.4, 27.8, 26.9,
      28.2, 29.1, 27.4, 26.0, 24.8, 25.6, 27.0, 28.5, 30.2, 29.4, 31.0, 32.4,
      31.1, 29.8, 28.2, 27.0, 28.6, 30.1, 29.2, 27.8, 26.4, 25.1, 24.0, 24.8,
      26.2, 25.4, 24.1, 23.0, 22.2, 23.5, 24.9, 24.2, 23.1, 22.0, 21.4, 20.8,
    ],
    signal: {
      bias: "short",
      headline:
        "Lower highs after the 32.4 spike · momentum fading · short bias on daily if 24.0 breaks",
      levels: [
        { label: "Resistance", value: "27.80" },
        { label: "Invalidation", value: "30.20" },
        { label: "Trigger", value: "Break < 24.00" },
        { label: "Target zone", value: "21.40 – 20.80" },
      ],
    },
    activity: [
      {
        id: "t1",
        at: "2026-07-26T18:12:00Z",
        status: "done",
        title: "Signal → short bias",
        detail: "Structure: LH sequence · RSI divergence on daily",
      },
      {
        id: "t2",
        at: "2026-07-26T06:00:00Z",
        status: "done",
        title: "Refreshed OHLCV",
        detail: "90d public candles fused with Cipher history",
      },
      {
        id: "t3",
        at: "2026-07-24T18:00:00Z",
        status: "done",
        title: "Neutral — wait",
        detail: "Range-bound between 24–28 · no clean trigger",
      },
      {
        id: "t4",
        at: "2026-07-20T18:00:00Z",
        status: "done",
        title: "Long bias expired",
        detail: "Failed hold above 30.2 · flipped watch to short setup",
      },
    ],
  },
];

export const DEMO_WALLETS: DemoWallet[] = [
  {
    walletId: "w-trading",
    address: "0xA1b2c3d4e5f6789012345678901234567890abcd",
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
        walletAddress: "0xA1b2c3d4e5f6789012345678901234567890abcd",
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        quantity: "6200.00",
        valueUsd: 6200,
        chainId: "base",
        walletId: "w-trading",
        walletLabel: "Trading",
        walletAddress: "0xA1b2c3d4e5f6789012345678901234567890abcd",
      },
      {
        symbol: "cbBTC",
        name: "Coinbase Wrapped BTC",
        quantity: "0.042",
        valueUsd: 3800.45,
        chainId: "base",
        walletId: "w-trading",
        walletLabel: "Trading",
        walletAddress: "0xA1b2c3d4e5f6789012345678901234567890abcd",
      },
    ],
  },
  {
    walletId: "w-sol",
    address: "7nYxK9mPqR2vL8wT4cB6hJ1sF3dA5gU0eZxWkP2",
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
        walletAddress: "7nYxK9mPqR2vL8wT4cB6hJ1sF3dA5gU0eZxWkP2",
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        quantity: "2420.40",
        valueUsd: 2420.4,
        chainId: "solana",
        walletId: "w-sol",
        walletLabel: "Solana",
        walletAddress: "7nYxK9mPqR2vL8wT4cB6hJ1sF3dA5gU0eZxWkP2",
      },
      {
        symbol: "JUP",
        name: "Jupiter",
        quantity: "1800",
        valueUsd: 1500.0,
        chainId: "solana",
        walletId: "w-sol",
        walletLabel: "Solana",
        walletAddress: "7nYxK9mPqR2vL8wT4cB6hJ1sF3dA5gU0eZxWkP2",
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
    asOf: new Date().toISOString(),
    wallets: DEMO_WALLETS,
    positions: [...positions].sort(
      (a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0),
    ),
  };
}
