# Ervo

AI crypto co-pilot — research and act through tools (no hardcoded flows).

## Stack (Phase 1)

- pnpm monorepo + Turborepo
- Next.js app (`apps/web`)
- OpenRouter + Vercel AI SDK (tool-calling agent)
- Zerion, DeFiLlama, Tavily, LI.FI, Turnkey
- Supabase (hosted) for plans/wallets + SSR auth helpers (memory fallback when service role unset)

##  



## Setup

```bash
pnpm install
cp .env.example apps/web/.env.local
# Required: OPENROUTER_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
#           NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
# Optional: ZERION_API_KEY, TAVILY_API_KEY, LIFI_API_KEY, Turnkey keys

# Apply schema to the linked hosted project (from repo root):
supabase link --project-ref YOUR_PROJECT_REF
supabase db push

pnpm --filter @ervo/web dev
```

Open [http://localhost:3001](http://localhost:3001) (or your configured port).

SSR clients: `apps/web/lib/supabase/{client,server,proxy}.ts` + `apps/web/proxy.ts`.  
Schema: `supabase/migrations/20260728000000_ervo_schema.sql`.

## Scripts

```bash
pnpm test          # package unit tests (db live smoke runs when SUPABASE_SERVICE_ROLE_KEY is set)
pnpm --filter @ervo/web build
pnpm --filter @ervo/web dev
```



## Docs

- Design: `docs/superpowers/specs/2026-07-25-ai-crypto-wallet-design.md`
- Phase 1 plan: `docs/superpowers/plans/2026-07-25-ervo-phase1.md`
- Open items: `TODO.md`

