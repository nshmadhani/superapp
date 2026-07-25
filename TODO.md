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
- [ ] **Phase 3 plan** — Jupiter / Kalshi-via-Jupiter + bridge multi-leg
- [ ] **Phase 4 plan** — paymaster/relayer + yield execute + recovery tooling
- [ ] **Execute Phase 1** (subagent-driven or inline)

## Demo sequencing (guidance from reviews — not locked)

Suggested build order if we cut scope: Demos 1–3 first → 7 + narrow 5 → Demo 4 → Demo 6 (HL/Poly execute; Jupiter-Kalshi via wallet). Revisit when writing the plan.
