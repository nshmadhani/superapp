# Cipher — AI Crypto Co-Pilot Design

**Date:** 2026-07-25  
**Status:** Draft for review (post design-review decisions)  
**Working name:** Cipher (keep for now)  
**Approach:** Adapter platform — one agent, implicit capabilities; consolidate many app UIs (Instadapp/Avocado thesis)  
**Wallet provider:** Turnkey (app-created wallets) + external connect (WalletConnect / injected)  
**Data / secrets store:** Supabase  

See also: [`TODO.md`](../../../TODO.md) for open follow-ups · [`VISION.md`](../../../VISION.md) for the one-page vision.

---

## 1. Vision

Cipher is **ChatGPT for crypto** and a **single interface over many crypto apps**: one chat + dashboard that replaces hopping between Uniswap, Aave, Polymarket, Hyperliquid, bridge UIs, and the rest — similar in spirit to **Instadapp** (consolidate protocol surfaces) and **Avocado** (multi-chain wallet abstraction), but **AI-native**: you state intent; the agent routes across adapters.

**One-liner:** One interface for research and action across wallets, chains, and venues — always with explicit wallet choice and confirmation.

**Primary users:** Active retail traders and DeFi power users (not a beginner-only “bank”).

**Agent capabilities (implicit — not product “modes” or UI toggles):**  
The agent can research, plan/execute with confirmation, and (later) run unattended policy-bound tasks. Users never pick “Researcher / Co-pilot / Autopilot”; they just talk. Capability shows up in what the agent can do, not as named modes in the product.

**Orchestration:** Tool-driven only. Do **not** hardcode demo flows or intent→recipe routers. The model chooses from available tools (portfolio, search, yields, create/simulate/execute plan, etc.); product behavior emerges from tool design + confirm gates.

**Consolidation thesis (Instadapp / Avocado):**
| Precedent | What they unified | What Cipher unifies |
|-----------|-------------------|---------------------|
| Instadapp | Many DeFi protocol UIs → one management layer | Many app/venue UIs → one agent + adapter layer |
| Avocado | Multi-chain EOAs → network/gas abstraction in one smart wallet | Multi-wallet + multi-chain inventory → one chat/dashboard; gas via **relayer + paymaster**; bridge/buy paths across funding sources |

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
- Dashboard also surfaces **VenueAccounts** for Hyperliquid / Polymarket when linked (separate from raw wallet balances).

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
- User confirms; wallet signs (gas sponsored via relayer/paymaster when applicable).

**Acceptance:** Co-pilot can refuse or hard-warn instead of blindly swapping; confirm UI shows route, slippage, and wallet.

### Demo 4 — Acquire an asset (three paths)

**User:** “Buy some HYPE for me.” (or any acquire intent)

**System:**
- Asks which wallet if needed (wallet picker and/or agent question).
- Considers **where funds live** vs **where the asset lives**.
- Agent offers what’s relevant among:
  1. **Same-chain / same-venue buy** — buy where the asset is tradeable with current funds.
  2. **Bridge (or deposit) then buy native** — move funds to the home venue/chain, then buy the **native** asset.
  3. **Buy wrapped / representation** — acquire a wrapped or bridged version where funds already are (honest about what the user receives).
- For ambiguous tickers, agent asks **native vs wrapped** (asset disambiguation left to the AI for now; structured registry later — see TODO).
- Multi-leg plans persisted in Supabase; gas via relayer/paymaster so destination legs are not stranded.
- Plan → simulate/quote per leg → user confirms → execute.

**Acceptance:** Agent does not assume a single chain; presents the relevant path(s); wallet/venue resolution is explicit; at least one end-to-end path is signable in the demo. Native HYPE implies a Hyperliquid-world path, not “Jupiter on Solana = native HYPE.”

### Demo 5 — Incident / hack explanation + recovery path

**User:** “What happened in my hack / with this weird ETH? Explain how it got messed up and help me get back to normal ETH.”

**System:**
- Investigates tx history, token contracts, approvals, and public incident context (research tools).
- Explains in plain language what happened.
- Proposes a **safe recovery plan** (e.g. revoke, swap out scam/wrapped asset) with warnings.
- User signs only the steps they approve.

**Acceptance:** Explanation is grounded in on-chain + public research; recovery is co-pilot guided, never silent auto-drain.

### Demo 6 — Prediction / perps venues + cross-venue discrepancy

**User:** Places or prepares trades on **Hyperliquid**, **Polymarket**, and/or **Kalshi-via-Jupiter**. Example: “Is there a Ballon d’Or 2026 winner market on Kalshi vs Polymarket with a price discrepancy I can arb?” Then: help execute.

**System:**
- **Hyperliquid / Polymarket:** require a **VenueAccount** (venue pocket linked to a backing wallet). Link via wallet-native auth; store derived/session material in **Supabase** when the venue needs it for API/order flow.
- **Kalshi path:** **Jupiter only** from Cipher’s POV (DFlow may exist under the hood; Cipher does not integrate DFlow directly). Outcome positions live as SPL in the **Solana wallet** — **no VenueAccount**.
- Research/compare markets across venues; plan legs; confirm; execute.

**Acceptance:** Cross-venue comparison + confirmable multi-leg plan; HL/Poly legs name VenueAccount + backing wallet; Jupiter-Kalshi leg names Solana wallet only.

### Demo 7 — Park capital securely (guided yield)

**User:** “I have $1,000 USDC. Best secure place to park it right now? Guide me.”

**System:**
- Asks preference questions (risk, lockup, chains, CeFi vs DeFi comfort).
- Discovers options via **DeFiLlama Yields API**; security-first framing (not APY-max only).
- Guides step-by-step; executes via protocol adapters (e.g. Aave / Morpho) only after confirm.

**Acceptance:** Feels like a co-pilot interview + plan, not a single opaque “best APY” dump.

---

## 3. Product surfaces

### 3.1 Chat (home)

Primary interaction: talk to one agent that researches and acts. No mode tabs or “switch to co-pilot.”

- Streaming replies, citations, tool cards (portfolio snapshot, research sources, tx plans).
- Wallet picker pop-up when an ask becomes wallet-scoped and wallets are ambiguous.
- For HL/Poly, resolve **VenueAccount** (create/link/fund if needed).
- Agent always states which wallet(s) / venue account(s) a plan will use.
- App/venue complexity stays behind adapters — user does not open separate Uniswap / bridge / Polymarket UIs for demo flows.

### 3.2 Dashboard (portfolio UI)

First-class, not a secondary afterthought.

- Connected wallet inventory (many wallets; target up to ~20).
- Per-wallet “world” view: balances, positions, chains, activity (Demo 1).
- **VenueAccounts** section: Hyperliquid + Polymarket pockets (balances, link status).
- Jupiter-Kalshi / prediction SPL tokens show under the Solana wallet (no separate venue account).
- Capability badges from adapters.
- Entry points into the same Transaction Review as chat.

### 3.3 Transaction Review

Canonical confirm UI for every execution:

- Human summary of intent  
- **From / to wallets** (always named)  
- **VenueAccount** when applicable (HL / Poly)  
- Chain, venue/adapter, route; native vs wrapped when relevant  
- Fees, slippage, simulation/quote result (`kind`: state-diff | quoted | estimated | unverifiable)  
- Risk / liquidity warnings  
- Confirm / Reject  

`confirmId` is single-use, short-lived, bound to a **structured Plan** hash. Review UI should render from that Plan object (not free-form model prose alone).

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

**Two ways to have a wallet:**

| Kind | How | Provider |
|------|-----|----------|
| **External** | User connects existing wallet (Rainbow, MetaMask, Phantom, …) | WalletConnect / injected — no Turnkey required |
| **App wallet** | Cipher creates/manages wallet for the user (embedded-style / programmable) | **Turnkey** (single wallet provider for this path) |

UI labels type so it’s obvious whether funds sit in a connected external wallet or a Turnkey-backed app wallet.

---

## 4.1 VenueAccount model

**Wallets** = funding sources and signers (chain balances).  
**VenueAccounts** = venue-side pockets where trading balances/positions live when that venue is not “just the wallet.”

| Venue | VenueAccount? | Notes |
|-------|---------------|--------|
| **Hyperliquid** | **Yes** | Deposit creates an HL account/pocket; may differ from EOA balances; optional agent/session material in Supabase |
| **Polymarket** | **Yes** | Proxy/deposit wallet / venue pocket linked to backing wallet; session/API material in Supabase after wallet-native link |
| **Jupiter (incl. Kalshi tokenized markets)** | **No** | Positions are SPL in the connected Solana wallet; Cipher talks to **Jupiter** only |
| Aave / Morpho / spot DEX | **No** | Protocol positions on the wallet |

Conceptual shape:

```text
VenueAccount {
  id
  venue: hyperliquid | polymarket
  backingWalletId   // funding / linking wallet
  venueAddressOrSubaccount
  balances[]
  status: needs_link | needs_deposit | ready
}
```

**Funding source** = wallet the user interacts from; it may **deposit into** a VenueAccount. Both exist in the inventory.

---

## 5. Architecture

```text
┌──────────────────────────────────────────────────────────┐
│  Web App                                                 │
│  Chat (home)  ·  Dashboard (wallets + VenueAccounts)     │
│  Tx Review                                               │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│  Agent Core (capabilities implicit; no mode UI)          │
│  Intent → resolve wallet / VenueAccount → Plan           │
│       → Simulate/Quote → Confirm → Execute               │
│  Research: open web · docs/RAG · on-chain · venue quotes │
└──────────────┬───────────────────────────┬───────────────┘
               │                           │
    ┌──────────▼──────────┐     ┌──────────▼──────────────┐
    │ Wallet Adapters     │     │ Action Adapters         │
    │ · External (WC)     │     │ · Transfer · Bridge     │
    │ · Turnkey (app)     │     │ · Swap · Jupiter        │
    │                     │     │ · Hyperliquid           │
    │                     │     │ · Polymarket            │
    │                     │     │ · Lend/yield · …        │
    └──────────┬──────────┘     └──────────┬──────────────┘
               │                           │
               │         ┌─────────────────▼──────────────┐
               │         │ Supabase                       │
               │         │ · Plans / steps (multi-leg)    │
               │         │ · Venue session secrets        │
               │         │ · Users / wallet inventory     │
               │         └────────────────────────────────┘
               │
               └──────────────────┬──────────────────────────
                                  ▼
              Chains / RPC / Indexers / Venue APIs
              Relayer + Paymaster (gas sponsorship)
```

**Key rules:**
- Chat/LLM never holds keys; signing via Wallet Adapters (external popup or Turnkey).
- **Intent → adapter routing:** agent maps asset/venue/intent to the correct Action Adapter.
- Capabilities = selected wallet(s) ∩ VenueAccount readiness (if needed) ∩ adapters ∩ chain/venue support.
- Multi-chain is a **chain + venue registry**, not one monolithic integration.
- Multi-leg execution is a **persisted Plan + Steps** in Supabase (resumable; no silent continue on partial failure).

---

## 6. Components

### 6.1 Agent Core

LLM + tool router. Tool families:

- `research_*` — open web (any reachable site), docs/RAG, news, social, protocol/venue status  
- `portfolio_*` — balances, positions, approvals, tx history for selected wallet(s)  
- `venue_account_*` — list/link/fund HL & Polymarket VenueAccounts  
- `venue_*` — quotes/markets on HL / Polymarket / Jupiter-Kalshi  
- `plan_action` / `simulate` / `execute` — execute only with valid `confirmId` (includes multi-step bridge→buy)  

### 6.2 Wallet Adapter interface

```text
connect | disconnect | getAccounts | getBalances | getPositions
signTransaction | sendTransaction | capabilities | custodyType
```

Implementations:
- **External** — WalletConnect / injected  
- **Turnkey** — app-created / programmable wallets (single provider for this path)

### 6.3 Action Adapter interface

```text
id | supportedChainsOrVenues | matches(intent, assetContext)
plan(intent, wallets, venueAccounts?) → steps
simulate(steps) → { kind, warnings, errors, quotes }
buildTxOrOrder(steps) → signable payloads
```

Steps are typed (transfer | swap | bridge | venue_order | lend | …) with dependencies, so multi-leg flows are explicit.

**Demo-required adapters (logical):**

| Adapter | Serves demos |
|---------|----------------|
| Portfolio indexer (read) | 1, 2, 5, 7 |
| Research (open web / any site + docs + on-chain) | 2, 5, 6, 7 |
| Swap (EVM aggregator + Solana / Jupiter) | 3, 4, 5, 6 (Kalshi-via-Jupiter) |
| Bridge (cross-chain) | 4 |
| Transfer | multi-wallet moves |
| Hyperliquid | 6 — uses VenueAccount |
| Polymarket | 6 — uses VenueAccount |
| Yield discovery (DeFiLlama) + lend/execute (Aave / Morpho) | 7 |

### 6.4 Research layer

- **Open web search** — any site the search/browse tools can reach  
- Optional specialized indexes (social, docs RAG) when they improve recall  
- On-chain and indexer reads for positions and contract state  
- Venue market APIs for prediction/perps comparison  
- Citations required on research answers  

### 6.5 Gas: relayer + paymaster

- Prefer **paymaster / relayer** sponsorship so bridge-then-buy and AA/Turnkey flows are not stranded without native gas.  
- External EOAs: sponsor when product chooses; otherwise surface gas needs in the Plan.  

### 6.6 Persistence (Supabase)

| Store | Purpose |
|-------|---------|
| Users / wallet inventory | Connected external + Turnkey wallets |
| VenueAccounts | HL + Polymarket link state and metadata |
| Plans + Steps | Multi-leg saga: status, idempotency, partial failure |
| Venue secrets | Encrypted session/API/agent material after wallet-native link |
| Portfolio snapshots | Optional `snapshotId` for chat ≡ dashboard parity |

### 6.7 Secrets (technical)

Wallet-native linking ≠ “Cipher stores nothing.”

- User connects wallet and signs to **link** HL / Polymarket.  
- Cipher may store **derived/session credentials** (encrypted) in Supabase so orders/quotes work without pasting API keys.  
- Jupiter path: primarily app-level Jupiter access + user signs Solana txs; no per-user VenueAccount.  
- Seed phrases / Turnkey raw key material are not sent to the LLM.

### 6.8 Policy engine (thin for demos)

- Always-confirm before broadcast/order submit  
- Optional max notional per confirm  
- Surface liquidity/slippage warnings from simulate/quote  
- Unattended / policy-bound execution = later capability of the same agent  

### 6.9 Asset disambiguation (current stance)

**Left to the AI for now:** ask native vs wrapped; if native, propose bridge/deposit path.  
**Later (TODO):** structured token/venue registry + mandatory mint/chain fields on every Plan.

---

## 7. Data flows

### 7.1 Research (no wallet)

User asks → research tools → streamed answer + citations.

### 7.2 Portfolio overview

User asks or opens dashboard → resolve wallet(s) if needed → portfolio tools → chat summary **and/or** dashboard from same portfolio service; include VenueAccounts for HL/Poly when present.

### 7.3 Co-pilot execute

1. User intent (swap, buy, venue trade, yield deploy, recovery step)  
2. Resolve wallet(s); resolve/create VenueAccount for HL/Poly if needed  
3. Disambiguate asset path (native / wrapped / bridge) via agent Q&A  
4. Route to Action Adapter(s) → persist Plan + Steps in Supabase  
5. `simulate` / quote per leg → Transaction Review + `confirmId`  
6. User confirms → `execute` (relayer/paymaster as applicable) → Wallet Adapter or venue API  
7. Update step status; chat + dashboard refresh  

### 7.4 Cross-venue (Demo 6)

1. Research/compare markets (Poly VenueAccount vs Jupiter-Kalshi wallet positions vs HL)  
2. Present discrepancy, fees, sequencing risks (basis risk called out honestly)  
3. Plan legs with correct wallet / VenueAccount each  
4. Confirm; execute in order; stop and explain on any leg failure  

### 7.5 Errors

| Case | Behavior |
|------|----------|
| Simulation/quote fail | Show reason; no sign prompt |
| Thin liquidity | Warn or block per thresholds; user may override if allowed |
| User reject | Invalidate `confirmId` |
| Wrong chain / funds elsewhere | Propose bridge-then-buy, wrapped buy, or switch wallet |
| Partial multi-leg | Persist completed legs; do not silently continue |
| VenueAccount not ready | Prompt link/deposit before planning trade |

---

## 8. Security & trust (product-technical)

Focused on correctness of execution, not a full compliance program:

- Keys never sent to the model.  
- No execute without Transaction Review confirm.  
- Plan hash binding on `confirmId`; prefer Review bound to structured Plan fields.  
- Simulation/quote warnings before sign when available.  
- Wallet type + VenueAccount labeled in UI.  
- Venue secrets encrypted at rest in Supabase; least-privilege server access.  
- Incident/recovery flows opt-in per step (Demo 5).  

---

## 9. Competitive context (short)

**Consolidation precedents:** Instadapp, Avocado.  
**AI / agent wallets:** CoveAI, MetaMask Agent Wallet, Coinbase/CDP, MoonPay Agents, Trust Wallet AI, etc.

**Differentiation:** AI front door over many adapters; wallets + VenueAccounts; Jupiter for Kalshi-tokenized markets; Turnkey app wallets + external connect; dual chat + dashboard.

---

## 10. Non-goals (this design phase)

- Building/shipping production code until implementation plan is approved  
- Explicit product modes / mode switcher UI  
- Unattended strategies as a demo requirement  
- Native mobile or Telegram as primary surface  
- Direct DFlow integration (Jupiter is the Cipher surface for that path)  
- Structured asset registry (deferred — AI disambiguation for now)  
- Rebuilding Instadapp/Avocado themselves  

---

## 11. Testing against demos

| Demo | Test focus |
|------|------------|
| 1 | Portfolio parity chat ≡ dashboard; VenueAccounts visible for HL/Poly when linked |
| 2 | Open-web research with citations |
| 3 | Thin-liquidity warning; confirm required |
| 4 | Plans for same-chain, bridge-then-native, and wrapped paths; multi-leg resume from Supabase |
| 5 | Explanation + opt-in recovery steps; no auto-execute |
| 6 | HL/Poly use VenueAccount; Jupiter-Kalshi uses wallet only; multi-leg confirm |
| 7 | DeFiLlama discovery → guided execute via lend adapter |

Agent evals: no `execute` without `confirmId`; plans name wallets / VenueAccounts correctly.

---

## 12. Decisions & remaining open items

### Decided

| Topic | Decision |
|-------|----------|
| Name | **Cipher** (keep for now) |
| App wallet provider | **Turnkey** (one provider for created wallets) |
| External wallets | **Connect only** (WalletConnect / injected) |
| VenueAccount | **Hyperliquid + Polymarket** only |
| Jupiter / Kalshi | **No VenueAccount**; Cipher integrates **Jupiter** (not DFlow directly) |
| Secrets | Encrypted in **Supabase** after wallet-native link when venue needs session material |
| Gas | **Relayer + paymaster** |
| Multi-leg state | **Supabase** Plans + Steps |
| Demo 4 | Same-chain **or** bridge-then-native **or** buy wrapped |
| Yield discovery | **DeFiLlama**; execute via protocol adapters (Aave / Morpho starters) |
| Asset disambiguation | **AI for now** (native vs wrapped Q&A); structured registry later |

### Yield venues — API split

1. **Discovery:** DeFiLlama Yields API  
2. **Execution:** per-protocol Action Adapters  
3. Demo 7: rank → guide → confirm → deposit  

### Still open

- Slippage / liquidity warn vs hard-block thresholds  
- Exact Morpho/Aave markets and chains for first Demo 7 execute path  
- Portfolio indexer vendor (Zerion / Alchemy / etc.)  
- Typed step schema / Plan trust-boundary hardening details in implementation plan  
- Demo sequencing for build order (see TODO.md)

---

## 13. Summary

Cipher is an **AI-native consolidation layer**: chat + dashboard over wallets (**Turnkey** app wallets + external connect), **VenueAccounts** for Hyperliquid and Polymarket, Jupiter for Kalshi-tokenized markets, Supabase for plans and secrets, and relayer/paymaster for gas. Research is open-web; execution is confirm-gated via structured Plans; capabilities are implicit. Success is the **seven demos**.
