# Demo polish: Pro dashboard + annotated TA simple chart

Date: 2026-07-26  
Scope: Seeded Cipher YC demo (`apps/web` demo surfaces only)

## Goals

1. **Pro dashboard** feels like a power view (graphs + KPIs), not Portfolio-plus-addresses.
2. **TA simple chart** teaches the read with on-chart annotations (price / wall / bias), still derived from the same live OHLC as the desk chart.

## Non-goals

- Live PnL, real equity history, or new market APIs beyond existing CoinGecko OHLC.
- Changing Glance / Portfolio chrome or depth toggle labels.
- Reworking the desk `ProTaChart` (candles / EMAs stay as-is).

---

## 1. Dashboard Pro (depth = Pro)

Keep Glance and Portfolio as they are. In Pro only, escalate density **in place**.

### Layout (top → bottom)

1. Header + Glance | Portfolio | Pro toggle (unchanged)
2. Net worth (overview or selected wallet)
3. **Charts row** (2 columns on desktop)
   - Asset allocation: horizontal stacked bar or donut-style SVG from `byAsset`
   - Chain allocation: same pattern from `byChain`
4. **KPI strip** (4 small metrics, derived from fixtures)
   - Top asset % (concentration)
   - Stable % (USDC / aUSDC / USDT / DAI)
   - Wallet count
   - Chain count
   - Optional: seeded “30d equity” sparkline (deterministic fake series scaled to net worth; labeled as illustrative, not live)
5. Wallet switcher + wallet cards (with short addresses)
6. Filters: chain, hide dust
7. Dense holdings table (existing Pro columns)
8. Position tree (wallet → chain → asset)

### Rules

- Same data as today; no new fixture fields required except optional sparkline seed in component.
- Charts are SVG/CSS only (no new chart library).
- No em dashes in copy.
- Do not default to Pro; Glance remains default.

---

## 2. TA annotated simple chart

Enhance `SimpleExplainChart` (after desk chart, before simple read card).

### On-chart annotations (max 3, not a sticker pile)

1. **Price here** — label + marker at last close (right edge of path)
2. **Wall / resistance** — label on the resistance dashed line (e.g. `Wall $68.10`)
3. **Floor / support** — label on the support dashed line
4. **Bias chip** — short text near last price (reuse `bias` string; keep small)

Optional fourth only if space: one plain callout under the chart summarizing structure in ≤1 line (from `structure` or `plainEnglish` truncated). Prefer on-chart labels first.

### Behavior

- Same live `series` / levels from `TaAnalysis`.
- Labels use SVG `<text>` (or foreignObject sparingly); avoid floating DOM badges over the plot.
- Keep “Simple view” framing: same live data, easier read.
- Human typing (`typeHuman`) stays as already shipped.

### Flow (unchanged order)

Desk chart → **annotated simple path** → simple read card → writeup.

---

## 3. Files likely touched

- `apps/web/components/demo/demo-dashboard.tsx` (Pro charts + KPIs)
- `apps/web/components/demo/simple-explain-chart.tsx` (annotations)
- Possibly small helpers colocated or `lib/demo/dashboard-viz.ts` if chart math gets noisy
- `ta-live-session.tsx` only if new props must be passed (`structure`)

## Success criteria

- Opening Pro: allocation charts and KPIs visible without scrolling past the fold on a laptop-ish viewport.
- Opening TA: after tools complete, a non-trader can point at “price / wall / floor / bias” on the simple chart without reading the markdown first.
- Glance / Portfolio unchanged in spirit; no em dashes; demo still runs without auth.

## Out of scope follow-ups

- Bind chat verbosity to depth toggle.
- Persist depth preference.
- Annotate the desk TradingView-style chart (pro chart stays unmarked beyond existing overlays).
