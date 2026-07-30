# Ervo Visual Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply scripted-demo Ervo UI/branding/layout/colors onto live `cursor/yc-agents-e2b-f496` with live data.

**Architecture:** Keep product data paths; lift presentation from `components/demo/*` into live components (or thin adapters). Brand strings → Ervo; CSS tokens already shared.

**Tech Stack:** Next.js app router, Tailwind v4, existing `/api/portfolio` + `/api/wallets`, Turnkey kit.

---

### Task 1: Brand rename (Ervo)

**Files:** `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`, `apps/web/components/sidebar.tsx`, `apps/web/components/chat/empty-state.tsx`, `apps/web/components/chat/chat-composer.tsx`, `apps/web/components/providers.tsx`, `apps/web/components/wallet-modal.tsx`, `apps/web/app/api/wallets/route.ts`, `apps/web/lib/sync-wallets.ts`

- [ ] Replace user-visible "Ervo" with "Ervo"
- [ ] Internal helpers use Ervo naming
- [ ] Smoke: home + sidebar show Ervo

### Task 2: Top bar chrome (live)

**Files:** `apps/web/components/top-bar.tsx`

- [ ] Match demo chip layout (border, mono truncated address, account strip) using real Turnkey wallet + login

### Task 3: Live dashboard ← demo layout

**Files:** copy/adapt `demo-dashboard.tsx` patterns into `dashboard-portfolio.tsx` (or new `components/portfolio/ervo-dashboard.tsx` used by dashboard page)

- [ ] Token icons, allocation bars, overview/drill-down from demo
- [ ] Data from existing portfolio/wallets APIs
- [ ] Soft fallback empty state when no balances

### Task 4: Multi-step / plan card visuals

**Files:** chat cards / tx-review related UI; pull styles from `demo-multi-step-card.tsx`

- [ ] Align plan review card borders/typography/wallet list with demo

### Task 5: Verify

- [ ] `pnpm --filter @ervo/rpc test`
- [ ] Typecheck touched files; start dev if down
