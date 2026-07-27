# LiFi Transfer Adapter Design

**Date:** 2026-07-26  
**Status:** Approved  
**Scope:** Replace 0x as primary swap path with LI.FI SDK for same-chain swaps and cross-chain bridges (EVM + Solana).

## Goal

Ervo uses **LI.FI as the universal transfer adapter**. Ervo owns confirm-gated Plans; the LiFi SDK owns routing and execution after the user confirms.

## Trust boundary

```
create_plan → LiFi getQuote (no broadcast)
           → Plan + Review UI
User Confirm → approveConfirm
           → LiFi convertQuoteToRoute + executeRoute / step send
           → getStatus until DONE (bridges)
```

Plan hash covers wallet + transfer steps. Route/quote JSON and unsigned tx data are stored on the plan but omitted from the hash (same pattern as prior `unsignedTx`).

## Adapter API (`@cipher/adapters`)

| Method | Where | Role |
|--------|--------|------|
| `quoteLifiTransfer` | server / agent | `getQuote` → review fields + serializable step/route |
| `getLifiStatus` | server or client | Poll bridge/swap status |
| Client execute helper | browser | After confirm: SDK route execution via Turnkey/wallet |

## Chains (first cut)

- EVM chains supported by LiFi (Base, Ethereum, Arbitrum, …)
- Solana (`1151111081099710`)
- Out of scope: Bitcoin, Sui, Tron

## Plan shape

- Step type `swap` or `bridge` (same-chain vs cross-chain) with `adapterId: "lifi"`
- `plan.lifiStep` / `plan.lifiRoute` — serialized LiFi quote/route for resume/execute
- `plan.unsignedTx` — source-chain tx fields when EVM (compat with Turnkey send)

## UI

Transaction Review shows from/to chain, tokens, min out, tool (DEX/bridge), ETA. Confirm still required before any SDK execution.

## Env (server-only)

- `LIFI_API_KEY` — never expose via `NEXT_PUBLIC_*`
- `LIFI_INTEGRATOR` — default `ciper-string`
- Quotes + status run on the server; the browser only signs the returned source tx via Turnkey

## Non-goals

- VenueAccounts (HL/Poly)
- Paymaster sponsorship
- Multi-wallet destination beyond `toAddress` on quote

## Migration

- `create_plan` uses LiFi only
- Removed `quoteEvmSwap` / 0x adapter and `ZEROX_API_KEY`
