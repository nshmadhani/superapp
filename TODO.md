# Cipher — TODO

Working decisions from design review (2026-07-25). Spec updated: `docs/superpowers/specs/2026-07-25-ai-crypto-wallet-design.md`. Vision doc: `VISION.md`.

## Decided

- [x] **Wallet provider:** Turnkey — one provider for app-created wallets; **external wallets just connect** (WalletConnect / injected)
- [x] **VenueAccount:** Hyperliquid + Polymarket only
- [x] **Jupiter (incl. Kalshi path):** no VenueAccount — use connected Solana wallet + positions; Cipher integrates Jupiter (not DFlow directly)
- [x] **Secrets / venue session material:** Supabase
- [x] **Gas:** relayer + paymaster
- [x] **Multi-leg plans:** persist plan/steps (Supabase); saga-style resume
- [x] **Demo 4 paths:** same-chain buy **or** bridge-then-buy native **or** buy wrapped/representation
- [x] **Yield discovery:** DeFiLlama; execute via protocol adapters
- [x] **Venue auth preference:** wallet-native linking; store derived/session secrets in Supabase when venue needs them
- [x] **Fold decisions into design doc**

## Open / later

- [ ] **Asset disambiguation:** leave to the AI for now; later add structured registry + mandatory mint/chain confirm in Transaction Review
- [ ] **Trust boundary / Plan object:** structured plan → Review UI renders only that → revalidate before sign (technical correctness)
- [ ] **Typed action steps:** swap vs bridge vs venue order vs Turnkey transfer (adapter workflows) — partially noted in spec; harden in implementation plan
- [ ] **Portfolio indexer vendor** (Zerion / Alchemy / etc.) for Demo 1 chat ≡ dashboard
- [ ] **Slippage / liquidity warn vs hard-block thresholds**
- [x] **Phase 1 implementation plan** — `docs/superpowers/plans/2026-07-25-cipher-phase1.md`
- [ ] **Phase 2 plan** — VenueAccount (HL + Polymarket) + venue secrets
- [x] **LiFi adapter** — replace 0x primary path; same-chain + bridge via `@lifi/sdk` (confirm-gated)
- [ ] **Phase 3 plan** — Kalshi-via-Jupiter refinements + multi-leg saga (bridges via LiFi)
- [ ] **Phase 4 plan** — paymaster/relayer + yield execute + recovery tooling
- [x] **Execute Phase 1 scaffold** — monorepo, packages, chat/dashboard, tool agent, tests + web build green (branch `feat/cipher-phase1`)
- [x] **Wire live env** — OpenRouter + Zerion + Tavily + LiFi (+ Turnkey) in `.env.local`
- [x] **Local Cipher Supabase** via CLI on ports 5442x (not other apps’ stacks)
- [x] **Persist plans/wallets to Supabase** when env set (`packages/agent` `store.ts`); memory fallback otherwise
- [x] **Phase 1 demos 1–3 wiring** — agent uses auth user wallets; portfolio ownership check; research citations UI; confirm-gated swap (`POST /api/plans/:id/confirm` + Turnkey sign)
- [ ] **Manual smoke** — login → portfolio chat≡dashboard → research cites → swap review Confirm & sign
- [ ] **Add remaining API keys** to `apps/web/.env.local` as needed: Alchemy / paymaster (Phase 4)

## Demo sequencing (guidance from reviews — not locked)

Suggested build order if we cut scope: Demos 1–3 first → 7 + narrow 5 → Demo 4 → Demo 6 (HL/Poly execute; Jupiter-Kalshi via wallet). Revisit when writing the plan.
