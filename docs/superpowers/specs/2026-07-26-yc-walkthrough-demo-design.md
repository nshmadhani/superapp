# Ervo — Seeded product demo (branch)

**Date:** 2026-07-26  
**Branch:** `cursor/yc-scripted-demo-54c0`  
**Status:** Implemented on branch (not for main merge until approved)

## Intent

Ervo UI that looks like the real product — preloaded chats, one autonomous agent, and dashboard. No auth / env / live chain required on this branch. Chat URLs use UUIDs.

## Information architecture

| Sidebar | Item | Route |
|---------|------|-------|
| Chats | Swap · Bridge · Lend | `/c/<uuid>` |
| Chats | Token / market research | `/c/<uuid>` |
| Chats | Technical analysis | `/c/<uuid>` |
| Chats | DCA agent | `/c/<uuid>` |
| Agents | DCA | `/agents/<uuid>` |
| — | Dashboard | `/dashboard` |

**Agents** = autonomous agents with a control panel + linked chat. TA is a **chat**, not an agent.

## Surfaces

- **Swap · Bridge · Lend:** Ambiguous ask (“0.4 ETH into a Kamino vault”) → wallet clarification → **one LI.FI** Base→Solana source tx + **Kamino deposit** on Solana.
- **Token / market research:** Broad brief (Twitter/CT, fundamentals, gov, risk) with citations.
- **Technical analysis:** Chat with price-history tool + chart + search.
- **DCA agent:** Asked + agent wallet + guard rails + allowed chains + activity; linked chat to change rules.
- **Dashboard:** Multi-wallet overview with drill-down (includes DCA agent wallet).

## Data

Static fixtures in `apps/web/lib/demo/fixtures.ts`. Providers stripped of Turnkey/Wagmi on this branch so the app opens without credentials.
