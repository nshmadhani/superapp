# Cipher — YC Walkthrough Demo

**Date:** 2026-07-26  
**Branch:** `cursor/yc-scripted-demo-54c0`  
**Status:** Implemented on branch (not for main merge until approved)

## Intent

A fake-but-finished Cipher you can open and walk through for YC. No typing, no env keys, no live chain calls. Preloaded chats, autonomous agents, and dashboard.

## Information architecture

| Sidebar | Item | Route |
|---------|------|-------|
| Chats | Swap · Bridge · Lend | `/c/swap-bridge-lend` |
| Chats | Token / DAO research | `/c/dao-research` |
| Agents | DCA | `/agents/dca` |
| Agents | Technical analysis | `/agents/ta` |
| — | Dashboard | `/dashboard` |

**Agents** = autonomous agents (control panel: brief + config + run activity). Not the in-chat tool strip.

## Surfaces

- **Chats:** Prebuilt message threads using existing `AgentRunView`, portfolio/citation cards, and plan cards.
  - **Swap · Bridge · Lend** is **one** multi-step saga with multi-wallet signing (Trading signs swap+bridge; Solana signs lend execute — not discovery-only).
- **Agents:** Control panel — what was asked, configuration, TA chart/signal when relevant, run activity feed.
- **Dashboard:** Multi-wallet overview with group-by wallet + chain chips and drill-down.

## Data

Static fixtures in `apps/web/lib/demo/fixtures.ts`. Providers stripped of Turnkey/Wagmi on this branch so the app opens without credentials.
