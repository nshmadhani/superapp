# Static Demo Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the static demo feel sharper by adding richer TA and research transcripts, explicit TA tool steps for data fetch plus code execution, and more visual pop in the dashboard without reintroducing animation.

**Architecture:** Keep the visible chat experience on fixture-driven static transcripts in `fixtures.ts`, since `DemoChatPanel` now routes all chats through `FixtureChatPanel`. Use existing renderers (`PriceChart`, `DemoTaCard`, citations, tool parts) by enriching fixture tool outputs and assistant text rather than reviving live-session components. For the dashboard, stay inside `demo-dashboard.tsx` and improve color hierarchy, icon styling, and card accents in place.

**Tech Stack:** Next.js / React, TypeScript, Tailwind classes, fixture-driven `UIMessage` parts, existing demo chart/card components

## Global Constraints

- Keep chats static; no typing, streaming, or live playback
- TA tool list must visibly include both price fetch and code execution
- No new market data source beyond existing CoinGecko-backed route references in copy/tool outputs
- Keep copy pitch-readable, not analyst-memo length
- No em dashes in demo copy

---

## File structure

- `apps/web/lib/demo/fixtures.ts`
  - Source of truth for TA and research transcripts
  - Add richer tool outputs and follow-up turns here
- `apps/web/components/demo/demo-dashboard.tsx`
  - Apply color/pop improvements to current Pro-only dashboard
- `apps/web/components/demo/demo-chat-panel.tsx`
  - Only touch if renderer needs small styling support for richer tool outputs

## Tasks

### 1. Enrich TA static transcript
- [ ] Update the TA fixture tool sequence to include:
  - [ ] `get_price_history` with explicit CoinGecko/source details
  - [ ] `run_ta_script` or equivalent code-execution-style tool
  - [ ] existing market context / search tool
- [ ] Expand the main TA assistant answer slightly so it reads like a real pass, not a compressed summary
- [ ] Add one follow-up user turn asking about invalidation / trigger quality
- [ ] Add one follow-up assistant answer resolving that question cleanly

### 2. Enrich research static transcript
- [ ] Keep the wide-angle first pass
- [ ] Add clearer tool outputs for web research, price history, and synthesis
- [ ] Expand catalyst / sentiment / unlock detail slightly
- [ ] Keep the existing follow-up compare-to-UNI exchange, but make it more specific and conversational

### 3. Add dashboard visual pop
- [ ] Strengthen token icon styling so icons read more intentional
- [ ] Add more color differentiation in KPI cards, section accents, and wallet badges
- [ ] Improve allocation and table visual hierarchy without changing layout structure
- [ ] Keep the page dark and clean; avoid clutter

### 4. Verify
- [ ] Run TypeScript check
- [ ] Scan touched files for unwanted punctuation / copy regressions
- [ ] Sanity-check that `DemoChatPanel` still renders fixture chats correctly
