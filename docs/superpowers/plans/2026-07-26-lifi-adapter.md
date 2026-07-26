# LiFi Adapter Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Swap/bridge via LI.FI SDK with Cipher confirm gate.

**Architecture:** Server quotes with `@lifi/sdk` `getQuote`; store step/route on Plan; after UI confirm, client executes via SDK + Turnkey and polls `getStatus`.

**Tech Stack:** `@lifi/sdk`, Turnkey `handleSendTransaction`, existing Plan/confirm store.

## Global Constraints

- Confirm before any broadcast
- EVM + Solana only in first cut
- Integrator name `ciper-string` (`LIFI_INTEGRATOR`, server-only)
- `LIFI_API_KEY` server-only — never `NEXT_PUBLIC_*`

---

### Task 1: Adapter quote + status

- [x] Add `@lifi/sdk` to `@cipher/adapters`
- [x] `quoteLifiTransfer` + `getLifiStatus` + chain helpers
- [x] Unit test with mocked getQuote

### Task 2: Plan types + create_plan

- [x] Extend Plan for lifi step/route
- [x] create_plan uses LiFi (drop EVM-only)
- [x] System prompt update

### Task 3: Confirm UI execute

- [x] Review card shows LiFi route fields
- [x] After approveConfirm, execute via LiFi/Turnkey

### Task 4: Env + smoke

- [x] `.env.example` LIFI_* keys
- [x] Build/tests green
- [ ] Manual smoke: Base swap + Solana swap + Base→Arbitrum bridge
