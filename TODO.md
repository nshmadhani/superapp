# Ervo — TODO

Working decisions from design review (2026-07-25). Spec updated: `docs/superpowers/specs/2026-07-25-ai-crypto-wallet-design.md`. Vision doc: `VISION.md`.

Feature-parity priorities from competitor analysis (Ask Gina / Otto / Cove / Surf + near rivals) — Jul 2026. Parity ≠ clone Gina: match category expectations, then win on home + trust.

## Decided

- [x] **Wallet provider:** Turnkey — one provider for app-created wallets; **external wallets just connect** (WalletConnect / injected)
- [x] **VenueAccount:** Hyperliquid + Polymarket only
- [x] **Jupiter (incl. Kalshi path):** no VenueAccount — use connected Solana wallet + positions; Ervo integrates Jupiter (not DFlow directly)
- [x] **Secrets / venue session material:** Supabase
- [x] **Gas:** relayer + paymaster
- [x] **Multi-leg plans:** persist plan/steps (Supabase); saga-style resume
- [x] **Demo 4 paths:** same-chain buy **or** bridge-then-buy native **or** buy wrapped/representation
- [x] **Yield discovery:** DeFiLlama; execute via protocol adapters
- [x] **Venue auth preference:** wallet-native linking; store derived/session secrets in Supabase when venue needs them
- [x] **Fold decisions into design doc**

## P0 — Table stakes (must ship for Direct-rival parity)

Without these, Ervo is “chat DeFi,” not in the Gina / Otto / Cove category.

- [ ] **Manual smoke (Phase 1)** — login → portfolio chat≡dashboard → research cites → swap review Confirm & sign
- [ ] **Trust boundary / Plan object** — structured plan → Review UI renders only that → revalidate before sign
- [ ] **Typed action steps** — swap vs bridge vs venue order vs Turnkey transfer (adapter workflows); harden in implementation
- [ ] **LiFi multi-leg finishable UX** — status, resume/saga so bridge→buy doesn’t strand users (adapter in; end-to-end incomplete)
- [ ] **Phase 2 plan** — VenueAccount (HL + Polymarket) + venue secrets
- [ ] **Hyperliquid VenueAccount** — link/fund + confirmable trade/deposit (biggest Direct-rival hole)
- [ ] **Polymarket VenueAccount** — link + confirmable order (incl. proxy-wallet discovery beyond EOA address lookup)
- [x] **Read-only HL + Polymarket balances** — dashboard Positions + `get_portfolio` (public APIs by linked address; no VenueAccount yet)
- [x] **Durable portfolio cache (Supabase `portfolio_cache`)** — 20m TTL; keys `address:<addr>` + `user:<id>:all`; dashboard + AI share; hard refresh bypasses. Address rows are the building block for a future public portfolio API
- [ ] **Portfolio chat ≡ dashboard truth** — durable multi-wallet inventory; no re-explaining holdings every session

## P1 — Compete (parity after home + venues are real)

- [ ] **Phase 3 plan** — Kalshi-via-Jupiter refinements + multi-leg saga (bridges via LiFi)
- [ ] **Phase 4 plan** — paymaster/relayer + yield execute + recovery tooling
- [ ] **Yield execute** — Aave/Morpho (etc.) adapters after confirm; discovery alone isn’t enough vs Otto
- [ ] **Gas sponsorship** — relayer + paymaster so multi-leg destination legs aren’t stranded
- [ ] **Slippage / liquidity warn vs hard-block thresholds**
- [ ] **Policy-bound DCA / scheduled automations** — hard spend limits + human kill switch (after confirm-gated home; not 24/7 alpha)
- [ ] **Asset disambiguation** — later: structured registry + mandatory mint/chain confirm in Transaction Review
- [ ] **Portfolio indexer vendor** (Zerion / Alchemy / etc.) hardening for Demo 1
- [ ] **Add remaining API keys** to `apps/web/.env.local` as needed: Alchemy / paymaster (Phase 4)

## P2 — Differentiate (win here — don’t dilute)

These are Ervo’s wedge vs bot-first rivals. Prioritize demos that show them.

- [ ] **Multi-path acquire (Demo 4)** — same-chain / bridge-then-native / buy wrapped; honest asset identity
- [ ] **Incident / hack recovery co-pilot (Demo 5)** — explain + safe recovery plan; never silent auto-drain
- [ ] **Cross-venue discrepancy (Demo 6)** — HL / Poly / Kalshi-via-Jupiter compare + confirmable multi-leg
- [ ] **Open research grounded in user’s bag** — citations; separate *your position* vs *market narrative*
- [ ] **Confirm-gated home composition** — dashboard + chat as one place; refuse thin liquidity / weird approvals

## Skip for now (not our fight)

Do not optimize roadmap for these — they pull off the consolidation-home thesis.

- [ ] ~~Custom agents / MCP into Claude/Cursor~~ — Gina / MetaMask Agent Wallet turf
- [ ] ~~Telegram / X social execution~~ — Bankr / Defyn culture; fights “single trusted home”
- [ ] ~~Spend card / consumer wallet extras~~ — Cove tilt; out of category
- [ ] ~~24/7 autonomous alpha~~ — rivals’ automation-first positioning; we stay confirm-first

## Done (foundation)

- [x] **Phase 1 implementation plan** — `docs/superpowers/plans/2026-07-25-ervo-phase1.md`
- [x] **LiFi adapter** — replace 0x primary path; same-chain + bridge via `@lifi/sdk` (confirm-gated)
- [x] **Execute Phase 1 scaffold** — monorepo, packages, chat/dashboard, tool agent, tests + web build green (branch `feat/ervo-phase1`)
- [x] **Wire live env** — OpenRouter + Zerion + Tavily + LiFi (+ Turnkey) in `.env.local`
- [x] **Local Ervo Supabase** via CLI on ports 5442x (not other apps’ stacks)
- [x] **Persist plans/wallets to Supabase** when env set (`packages/agent` `store.ts`); memory fallback otherwise
- [x] **Phase 1 demos 1–3 wiring** — agent uses auth user wallets; portfolio ownership check; research citations UI; confirm-gated swap (`POST /api/plans/:id/confirm` + Turnkey sign)

## Demo sequencing (guidance from reviews — not locked)

Suggested build order if we cut scope: Demos 1–3 first → venues (HL/Poly) → 7 + narrow 5 → Demo 4 → Demo 6 (HL/Poly execute; Jupiter-Kalshi via wallet). Revisit when writing Phase 2+.
