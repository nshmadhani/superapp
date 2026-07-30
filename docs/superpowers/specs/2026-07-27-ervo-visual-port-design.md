# Ervo visual system on live product

**Date:** 2026-07-27  
**Base branch:** `cursor/yc-agents-e2b-f496`  
**Visual source:** `cursor/yc-scripted-demo-54c0`  
**Approach:** Demo shell + live data (hybrid)

## Goal

Ship the product as **Ervo** using the scripted demo’s UI, branding, layout, and colors, while keeping live Turnkey auth, chats, agents, portfolio, and plan execution.

## In scope

- User-facing rename Ervo → **Ervo** (metadata, sidebar, empty states, composer, wallet default label, WC metadata)
- Shell chrome: zinc tokens, sidebar IA, top-bar chip styling (live wallet address, not fixture)
- Home: Ervo hero + tagline; keep live chat create + composer
- Dashboard: adopt `DemoDashboard` layout (allocation bars, token icons, equity spark, wallet drill-down) fed by `/api/portfolio` + `/api/wallets`
- Chat/plan surfaces: adopt demo multi-step / plan card visual language where live tool cards exist
- Preserve Turnkey sign-only + QuickNode broadcast path already on this branch

## Out of scope

- Fixture playback / demo live sessions as product paths
- Replacing live providers with demo mocks
- Package rename `@ervo/*` (internal)

## Success

Logged-in user sees Ervo branding; dashboard matches demo density/visuals with real balances; confirm/sign still works.
