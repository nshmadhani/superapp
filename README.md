# Cipher

AI crypto co-pilot — research and act through tools (no hardcoded flows).

## Stack (Phase 1)

- pnpm monorepo + Turborepo
- Next.js app (`apps/web`)
- OpenRouter + Vercel AI SDK (tool-calling agent)
- Zerion, DeFiLlama, Tavily, Alchemy, 0x, Turnkey
- In-memory plan/wallet store for local Phase 1 (Supabase schema ready in `packages/db`)

## Setup

```bash
pnpm install
cp .env.example .env.local
# fill OPENROUTER_API_KEY (required for chat)
# optional: ZERION_API_KEY, TAVILY_API_KEY, ZEROX_API_KEY, ALCHEMY_API_KEY, Turnkey keys
pnpm --filter @cipher/web dev
```

Open [http://localhost:3000/chat](http://localhost:3000/chat).

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
