# Cipher — AI Crypto Co-Pilot Design

**Date:** 2026-07-25  
**Status:** Draft for review  
**Working name:** Cipher (placeholder)  
**Approach:** Adapter platform (research + co-pilot; autopilot later)

---

## 1. Vision

Cipher is **ChatGPT for crypto** and a **single interface over many crypto apps**: one chat + dashboard that replaces hopping between Uniswap, Aave, Polymarket, Hyperliquid, bridge UIs, and the rest — similar in spirit to **Instadapp** (consolidate protocol surfaces) and **Avocado** (multi-chain wallet abstraction), but **AI-native**: you state intent; the agent routes across adapters.

**One-liner:** One interface for research and action across wallets, chains, and venues — always with explicit wallet choice and confirmation.

**Primary users:** Active retail traders and DeFi power users (not a beginner-only “bank”).

**Agent capabilities (implicit — not product “modes” or UI toggles):**  
The agent can research, plan/execute with confirmation, and (later) run unattended policy-bound tasks. Users never pick “Researcher / Co-pilot / Autopilot”; they just talk. Capability shows up in what the agent can do, not as named modes in the product.

**Consolidation thesis (Instadapp / Avocado):**
| Precedent | What they unified | What Cipher unifies |
|-----------|-------------------|---------------------|
| Instadapp | Many DeFi protocol UIs → one management layer | Many app/venue UIs → one agent + adapter layer |
| Avocado | Multi-chain EOAs → network/gas abstraction in one smart wallet | Multi-wallet + multi-chain inventory → one chat/dashboard; bridge/buy paths especially strong for multi-chain & custodial wallets |

**Not (for this design):** CEX replacement, social feed, explicit mode switcher, or “AI moonshot tips” without evidence.

---

## 2. Demo success criteria (the product focus)

These seven demos define what the system must support. If a demo fails, the design is incomplete.

### Demo 1 — Wallet overview (chat + UI)

**User:** Connects Rainbow (or any supported wallet) and asks: “Give me a good overview of what my wallet has right now.”

**System:**
- Reads tokens, balances, and detectable protocol positions for that wallet.
- Answers in chat with a clear breakdown.
- **Also shows the same holdings in a dashboard UI** (not chat-only). The UI is the “Rainbow world” view: assets, positions, chain breakdown, recent activity.

**Acceptance:** User can see holdings in both chat and dashboard for a selected/connected wallet without re-explaining context every time they open the dashboard (dashboard is bound to connected wallet inventory; chat asks which wallet when ambiguous).

### Demo 2 — Open research (any site / source)

**User:** “I have 500 in [protocol]. What’s going on with it?” (or any crypto research ask)

**System:**
- Resolves which protocol/position (from portfolio and/or user naming) when relevant.
- Researches via **open web search across literally any site** the tools can reach (docs, forums, news, dashboards, X/Twitter, GitHub, governance portals, etc.), plus docs/RAG and on-chain status when useful.
- Returns a status briefing with sources and risk framing.

**Acceptance:** Not limited to a fixed allowlist of “crypto sites”; answers cite whatever sources were used; distinguishes “what you hold” vs “what’s going on out there.”

### Demo 3 — Smart swap co-pilot (liquidity-aware)

**User:** “I have this ETH flavor / token — swap it to normal ETH.”

**System:**
- Identifies the asset and chooses the right **swap/action adapter** for that chain/asset.
- Simulates route; **warns on thin liquidity, high slippage, weird approvals**, or unsafe tokens.
- User confirms; wallet signs.

**Acceptance:** Co-pilot can refuse or hard-warn instead of blindly swapping; confirm UI shows route, slippage, and wallet.

### Demo 4 — Acquire an asset (same-chain buy **or** bridge-then-buy)

**User:** “Buy some HYPE for me.”

**System:**
- Asks which wallet if needed (wallet picker and/or agent question).
- Considers **where funds live** vs **where the asset is best acquired**.
- Options the agent should surface:
  1. **Same-chain buy** — e.g. connect/use a Solana wallet and buy HYPE on Solana.
  2. **Bridge then buy** — funds on another chain → bridge (or custodial/multi-chain internal move) → buy on the destination venue/chain.
- Especially important when the wallet is **multi-chain** or **custodial**: the agent can propose a path that uses one account’s balances across chains without forcing the user to manually juggle separate app UIs.
- Plan → simulate (bridge + swap legs, fees, time, risk) → user signs each required step.

**Acceptance:** Agent does not assume a single chain; presents same-chain vs bridge-then-buy when relevant; wallet/chain resolution is explicit; at least one end-to-end path is signable in the demo.

### Demo 5 — Incident / hack explanation + recovery path

**User:** “What happened in my hack / with this weird ETH? Explain how it got messed up and help me get back to normal ETH.”

**System:**
- Investigates tx history, token contracts, approvals, and public incident context (research tools).
- Explains in plain language what happened.
- Proposes a **safe recovery plan** (e.g. revoke, swap out scam/wrapped asset) with warnings.
- User signs only the steps they approve.

**Acceptance:** Explanation is grounded in on-chain + public research; recovery is co-pilot guided, never silent auto-drain.

### Demo 6 — Prediction / perps venues + cross-venue discrepancy

**User:** Places or prepares trades on **Hyperliquid**, **Polymarket**, and/or **Kalshi**. Example: “Is there a Ballon d’Or 2026 winner market on Kalshi vs Polymarket with a price discrepancy I can arb?” Then: help execute the arb technique.

**System:**
- Venue **action adapters** for quote/order/position where APIs allow.
- Research/compare markets across venues.
- Surfaces discrepancy, fees, and execution constraints; plans legs; user confirms each (or batched where safe).

**Acceptance:** Demo can show cross-venue comparison and a confirmable multi-leg plan; agent labels which wallet/account each venue uses.

### Demo 7 — Park capital securely (guided yield)

**User:** “I have $1,000 USDC. Best secure place to park it right now? Guide me.”

**System:**
- Asks preference questions (risk, lockup, chains, CeFi vs DeFi comfort).
- Researches current options with security-first framing (audits, incumbency, liquidity, oracle/risk notes — not APY-max only).
- Guides step-by-step; executes via adapters only after confirm.

**Acceptance:** Feels like a co-pilot interview + plan, not a single opaque “best APY” dump.

---

## 3. Product surfaces

### 3.1 Chat (home)

Primary interaction: talk to one agent that researches and acts. No mode tabs or “switch to co-pilot.”

- Streaming replies, citations, tool cards (portfolio snapshot, research sources, tx plans).
- Wallet picker pop-up when an ask becomes wallet-scoped and wallets are ambiguous.
- Agent always states which wallet(s) a plan will use.
- App/venue complexity stays behind adapters — user does not open separate Uniswap / bridge / Polymarket UIs for demo flows.

### 3.2 Dashboard (portfolio UI)

First-class, not a secondary afterthought.

- Connected wallet inventory (many wallets; target up to ~20).
- Per-wallet “world” view: balances, positions, chains, activity (Demo 1).
- Capability badges from adapters (swap, bridge, HL, Polymarket, etc.).
- Entry points into the same Transaction Review as chat.

### 3.3 Transaction Review

Canonical confirm UI for every execution:

- Human summary of intent  
- **From / to wallets** (always named)  
- Chain, venue/adapter, route  
- Fees, slippage, simulation result  
- Risk / liquidity warnings  
- Confirm / Reject  

`confirmId` is single-use, short-lived, bound to a plan hash.

---

## 4. Wallet model

**Sessions do not own wallets.** A session is a conversation. Wallets live at the **user account** level as an inventory the user connects over time.

| Rule | Detail |
|------|--------|
| Many wallets | User may connect ~20 wallets of mixed types |
| Resolve when needed | Portfolio or execute paths must resolve wallet(s) via picker and/or agent question |
| No silent default drift | Every plan/confirm names wallet(s) explicitly |
| Multi-wallet ops | First-class (e.g. move funds Hot → Yield); confirm shows both |
| Research without wallet | General market/protocol Q&A needs no wallet |

**Custody as adapter property** (depends on what the user brings):

- **External** — WalletConnect / injected (Rainbow, MetaMask, Phantom, …)  
- **Embedded** — MPC / smart account (e.g. Privy, Dynamic); may be multi-chain like Avocado-style AA  
- **Custodial** — provider API custody; often strongest for seamless cross-chain “move then buy” paths  

UI always labels custody type so trust level is obvious. Multi-chain / custodial wallets should expose **cross-chain balance + transfer capabilities** to the agent so Demo 4 bridge-then-buy is natural.

---

## 5. Architecture

```text
┌──────────────────────────────────────────────────────────┐
│  Web App                                                 │
│  Chat (home)  ·  Dashboard (wallet worlds)  ·  Tx Review │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│  Agent Core (capabilities implicit; no mode UI)          │
│  Intent → (resolve wallets) → Plan → Simulate/Warn       │
│         → Confirm → Execute                              │
│  Research: open web (any site) · docs/RAG · on-chain     │
│            · venue quotes                                │
└──────────────┬───────────────────────────┬───────────────┘
               │                           │
    ┌──────────▼──────────┐     ┌──────────▼──────────────┐
    │ Wallet Adapters     │     │ Action Adapters         │
    │ · External (WC)     │     │ · Transfer · Bridge     │
    │ · Embedded (MPC/AA) │     │ · Swap (per VM/venue)   │
    │ · Custodial (API)   │     │ · Hyperliquid           │
    │                     │     │ · Polymarket · Kalshi   │
    │                     │     │ · Lend/yield · …        │
    └──────────┬──────────┘     └──────────┬──────────────┘
               │                           │
               └─────────────┬─────────────┘
                             ▼
              Chain / RPC / Indexer / Venue APIs
```

**Key rules:**
- Chat/LLM never holds keys; signing only via Wallet Adapters.
- **Intent → adapter routing:** agent (and registry metadata) maps asset/venue/intent to the correct Action Adapter (e.g. Solana spot buy ≠ Hyperliquid perp ≠ Polymarket order).
- Capabilities for a turn = selected wallet(s) ∩ registered action adapters ∩ chain/venue support.
- Multi-chain is a **chain + venue registry**, not one monolithic integration.

---

## 6. Components

### 6.1 Agent Core

LLM + tool router. Tool families:

- `research_*` — open web (any reachable site), docs/RAG, news, social, protocol/venue status  
- `portfolio_*` — balances, positions, approvals, tx history for selected wallet(s)  
- `venue_*` — quotes/markets on HL / Polymarket / Kalshi  
- `plan_action` / `simulate` / `execute` — execute only with valid `confirmId` (includes multi-step bridge→buy)  

### 6.2 Wallet Adapter interface

```text
connect | disconnect | getAccounts | getBalances | getPositions
signTransaction | sendTransaction | capabilities | custodyType
```

Implementations: External (WalletConnect), Embedded (one provider), Custodial (interface + chosen provider).

### 6.3 Action Adapter interface

```text
id | supportedChainsOrVenues | matches(intent, assetContext)
plan(intent, wallets) → steps
simulate(steps) → warnings | errors | quotes
buildTxOrOrder(steps) → signable payloads
```

**Demo-required adapters (logical):**

| Adapter | Serves demos |
|---------|----------------|
| Portfolio indexer (read) | 1, 2, 5, 7 |
| Research (open web / any site + docs + on-chain) | 2, 5, 6, 7 |
| Swap (EVM aggregator + Solana aggregator) | 3, 4, 5 |
| Bridge (cross-chain) | 4, multi-chain paths |
| Transfer | multi-wallet moves |
| Hyperliquid | 6 |
| Polymarket | 6 |
| Kalshi | 6 |
| Yield/lend (starter set) | 7 |

Adapters can be added without changing Agent Core contracts.

### 6.4 Research layer

- **Open web search** — any site the search/browse tools can reach (not a closed crypto-only allowlist)  
- Optional specialized indexes (social, docs RAG) when they improve recall  
- On-chain and indexer reads for positions and contract state  
- Venue market APIs for prediction/perps comparison  
- Citations required on research answers  

### 6.5 Policy engine (thin for demos)

- Always-confirm before broadcast/order submit  
- Optional max notional per confirm  
- Surface liquidity/slippage/security warnings from simulate  
- Unattended / policy-bound execution = later capability of the same agent (still not a UI “mode”)  

---

## 7. Data flows

### 7.1 Research (no wallet)

User asks → research tools → streamed answer + citations.

### 7.2 Portfolio overview

User asks or opens dashboard → resolve wallet(s) if needed → portfolio tools → chat summary **and/or** dashboard render from same portfolio service.

### 7.3 Co-pilot execute

1. User intent (swap, buy, venue trade, yield deploy, recovery step)  
2. Resolve wallet(s) / venue accounts  
3. Route to Action Adapter(s) via `matches` + agent reasoning  
4. `plan` → `simulate` (liquidity, revert, risk)  
5. Transaction Review + `confirmId`  
6. User confirms → `execute` → Wallet Adapter signs/submits  
7. Chat card + dashboard refresh  

### 7.4 Cross-venue arb (Demo 6)

1. Research/compare markets across adapters  
2. Present discrepancy, fees, size limits, sequencing risks  
3. Plan legs (possibly different wallets/accounts per venue)  
4. Confirm each leg (or explicit multi-leg confirm)  
5. Execute in order; stop and explain on any leg failure  

### 7.5 Errors

| Case | Behavior |
|------|----------|
| Simulation fail | Show reason; no sign prompt |
| Thin liquidity | Warn or block per thresholds; user may override if allowed |
| User reject | Invalidate `confirmId` |
| Wrong chain / funds elsewhere | Propose bridge-then-buy or switch wallet; never assume single-chain |
| Partial multi-leg | Leave completed legs visible; do not silently continue |

---

## 8. Security & trust

- Keys never sent to the model.  
- No execute without Transaction Review confirm.  
- Plan hash binding on `confirmId`.  
- Simulation and risk warnings before sign when available.  
- Custody type labeled on every wallet.  
- Least-privilege adapter credentials server-side.  
- Incident/recovery flows are explanatory and opt-in per step (Demo 5).  

---

## 9. Competitive context (short)

**Consolidation precedents:**
- **Instadapp** — one layer over many DeFi protocols instead of each protocol’s UI  
- **Avocado** — multi-chain smart wallet / network+gas abstraction so users stop chain-switching  

**AI / agent wallets:** CoveAI, MetaMask Agent Wallet, Coinbase/CDP agent wallets, MoonPay Agents, Trust Wallet AI, various DeFi chat agents.

**Differentiation this design targets:**
- **Instadapp-style consolidation + AI front door** — replace per-app UIs with one agent/adapter interface (DeFi, bridges, perps, prediction markets)  
- **Avocado-like multi-chain paths** — especially bridge-then-buy for multi-chain and custodial wallets  
- Open research (any site), not a thin prompt wrapper  
- Dual surface: chat home **and** real multi-wallet dashboard  
- Wallet inventory ≠ session; always-confirm which wallet acts  
- Implicit agent capabilities (no mode switcher)  
- Warnings (liquidity, incident context), not mute execution  

---

## 10. Non-goals (this design phase)

- Building/shipping production code (design-only until implementation plan is approved)  
- Explicit product modes / mode switcher UI  
- Unattended strategies as a demo requirement (same agent may gain this later)  
- Native mobile or Telegram as primary surface  
- Supporting every chain/protocol at equal depth on day one (registry grows; demos define minimum depth)  
- Rebuilding Instadapp/Avocado themselves — we take the consolidation idea, not their stack by default  

---

## 11. Testing against demos

| Demo | Test focus |
|------|------------|
| 1 | Portfolio service parity: chat summary ≡ dashboard for same wallet |
| 2 | Open-web research returns citations from arbitrary sources; protocol resolved from position or name |
| 3 | Thin-liquidity fixture produces warning; confirm required |
| 4 | Same-chain buy **and** bridge-then-buy plans; multi-chain/custodial path suggested when funds are elsewhere |
| 5 | Fixture “incident” txs → explanation + safe plan; no auto-execute |
| 6 | Cross-venue quote compare + multi-leg confirm sequencing |
| 7 | Preference Q&A → ranked secure options → optional execute path |

Agent evals: prompts must not call `execute` without `confirmId`; multi-wallet prompts must name wallets in the plan.

---

## 12. Open decisions (product, not blockers for design)

- Final product name/branding  
- Exact embedded and custodial vendors  
- Slippage/liquidity warn vs hard-block thresholds  
- Kalshi/Polymarket/Hyperliquid API auth UX (API keys vs wallet-native)  
- Which yield venues are in the first Demo 7 shortlist  

---

## 13. Summary

Cipher is an **adapter-platform AI co-pilot**: many connected wallets, chat + dashboard, research with web/X/on-chain, and confirm-gated execution across swaps and venues. Success is measured by the **seven demos** above — including a real UI for wallet holdings, not chat alone.
