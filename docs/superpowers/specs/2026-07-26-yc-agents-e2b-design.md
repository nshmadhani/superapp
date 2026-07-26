# Cipher — YC Agents Surface (E2B) Design

**Date:** 2026-07-26  
**Status:** Approved for implementation (Approach 2)  
**Branch:** `cursor/yc-agents-e2b-f496`

## Goal

Ship three product surfaces for the YC demo: **Chat · Agents · Dashboard**.

- **Chat** — interactive swap / bridge / lend (existing LiFi + yields). Can spawn agent runs.
- **Agents** — first-class one-shot autonomous jobs (DCA, TA, DAO research) executed in **E2B** sandboxes.
- **Dashboard** — existing portfolio page with clearer multi-wallet / chain group-by.

## Agent job model

```ts
AgentRun {
  id, userId
  type: "dca" | "ta" | "dao_research"
  goal: string
  policy: Record<string, unknown>
  status: "queued" | "running" | "needs_confirm" | "succeeded" | "failed" | "cancelled"
  steps: { id, label, status, detail?, at }[]
  artifact: object | null
  source: "live" | "fallback" | null
  sandboxId?: string
  error?: string
  createdAt, updatedAt, finishedAt?
}
```

## Runtime

1. `POST /api/agents` creates a run (`queued`) and kicks an in-process worker.
2. Worker sets `running`, appends steps, opens an E2B Code Interpreter sandbox when `E2B_API_KEY` is set.
3. Type runners:
   - **DCA** — schedule math + optional confirm plan stub in sandbox; artifact = schedule card.
   - **TA** — fetch public OHLCV (Binance), run indicator/signal code in E2B; artifact = series + bias.
   - **DAO research** — Tavily search + E2B summarization; artifact = brief + citations.
4. Money-moving steps reuse Plan + Tx Review (`needs_confirm`). One-shot YC agents do not auto-broadcast.
5. On timeout/API/E2B failure → **hard fallback artifact** (`source: "fallback"`) so the demo never stalls.

## Historical / public data (TA)

| Source | Use | Auth |
|--------|-----|------|
| Binance public klines | OHLCV for majors | none |
| CoinGecko market_chart | backup / non-Binance tickers | none (rate-limited) |
| Tavily | DAO / token research | `TAVILY_API_KEY` |

Data is fetched server-side, then injected into the E2B sandbox for analysis (indicators stay in the sandbox).

## Packages / routes

- `packages/agent-jobs` — types, store, E2B client, runners, fallbacks
- `GET/POST /api/agents`, `GET /api/agents/[runId]`, `POST /api/agents/[runId]/cancel`
- UI: `/agents`, `/agents/[runId]`; sidebar nav item
- Chat tool: `spawn_agent` → creates run, returns link

## Out of scope (this PR)

- Persistent cron / recurring DCA execution
- Real lend deposit adapter
- Redis/SQS queue (in-process worker is enough for demo)
