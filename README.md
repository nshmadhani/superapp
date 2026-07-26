# Cipher

AI crypto co-pilot — research and act through tools (no hardcoded flows).

## Stack (Phase 1)

- pnpm monorepo + Turborepo
- Next.js app (`apps/web`)
- OpenRouter + Vercel AI SDK (tool-calling agent)
- Zerion, DeFiLlama, Tavily, LI.FI, Turnkey
- Supabase for plans/wallets (memory fallback when unset)

## Setup

```bash
pnpm install
cp .env.example apps/web/.env.local
# fill OPENROUTER_API_KEY (required for chat)
# optional: ZERION_API_KEY, TAVILY_API_KEY, LIFI_API_KEY, Turnkey keys
pnpm --filter @cipher/web dev
```

Open [http://localhost:3001](http://localhost:3001) (or your configured port).

## Scripts

```bash
pnpm test          # package unit tests
pnpm --filter @cipher/web build
pnpm --filter @cipher/web dev
```

## Docs

- Design: `docs/superpowers/specs/2026-07-25-ai-crypto-wallet-design.md`
- Phase 1 plan: `docs/superpowers/plans/2026-07-25-cipher-phase1.md`
- Open items: `TODO.md`
