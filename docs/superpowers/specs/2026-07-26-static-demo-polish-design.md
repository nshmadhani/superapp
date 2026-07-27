# Static demo polish: color, richer transcripts, explicit TA tools

Date: 2026-07-26  
Scope: Seeded Ervo YC demo (`apps/web` demo surfaces only)

## Goals

1. Make the **dashboard** feel sharper and more premium with selective color and clearer token identity.
2. Keep **TA** and **Token / market research** as **static chats**, but make them feel more real with richer visible tool calls and a longer back-and-forth transcript.
3. Make **TA tool calls** explicitly show both:
   - price history fetched from an external source
   - code execution / quant analysis run on that data

## Non-goals

- Reintroducing typing animation or live playback.
- Adding new data providers beyond the existing CoinGecko-backed OHLC route.
- Turning the dashboard into a separate light-theme or heavily redesigned experience.

---

## 1. Dashboard visual polish

Keep the current single dashboard view and structure, but make it pop more.

### Changes

1. Strengthen token color identity across:
   - allocation bars
   - KPI accents
   - token icons
   - table rows / pills where tasteful
2. Increase contrast and polish on:
   - wallet cards
   - chain pills
   - section headers
   - KPI cards
3. Keep the product dark and serious; use color as emphasis, not decoration.

### Visual rules

- ETH / Base / Solana / stablecoin colors should be recognizable at a glance.
- Do not add motion.
- Do not add more layout complexity just to use color.

---

## 2. TA static transcript upgrade

Keep TA non-animated, but make the transcript deeper and more conversational.

### Transcript shape

1. User asks for a proper TA pass.
2. Assistant shows tool sequence:
   - fetch price history from CoinGecko-backed route
   - execute quant / chart analysis code on the candle set
   - web search / market context
3. Assistant gives the main TA response.
4. User asks a short follow-up such as invalidation / trigger / setup nuance.
5. Assistant replies with a shorter follow-up answer.

### Tool naming / outputs

- One visible tool should read like external data fetch, e.g. `get_price_history`.
- One visible tool should read like code execution, e.g. `run_ta_script` or `execute_quant_code`.
- Tool outputs should explicitly mention:
  - source (`CoinGecko`)
  - timeframe (`1D`)
  - candle count / lookback
  - what the code computed (trend, EMA, RSI, levels)

### Content rules

- More detailed than today, but still pitch-readable.
- Desk chart + annotated simple chart remain.
- The follow-up should make the exchange feel less like a one-shot dump.

---

## 3. Token / market research static transcript upgrade

Keep research non-animated, but make it read like an actual analyst exchange.

### Transcript shape

1. User asks for a wide-angle read on HYPE.
2. Assistant shows tool sequence:
   - source gathering / web research
   - price-history fetch
   - synthesis step
3. Assistant gives a broad first answer.
4. User asks a follow-up about unlocks / CT drama / UNI comparison.
5. Assistant gives a second, more specific answer.

### Content rules

- Keep the current annotated simple chart and research desk card.
- Add more detail around:
  - sentiment split
  - price-moving catalysts
  - unlock overhang
  - why HYPE behaves differently from UNI
- Keep it concise enough for a demo, not a memo.

---

## 4. Files likely touched

- `apps/web/components/demo/demo-dashboard.tsx`
- `apps/web/lib/demo/fixtures.ts`
- `apps/web/components/demo/demo-chat-panel.tsx`
- Possibly `apps/web/components/demo/demo-ta-card.tsx`
- Possibly `apps/web/components/demo/demo-research-card.tsx`

## Success criteria

- Dashboard reads as more premium and legible within 2 seconds of landing.
- TA static chat visibly includes both **price fetch** and **code execution** tool steps.
- TA and research each contain at least one extra follow-up exchange beyond the first answer.
- No typing / streaming / auto-play animation remains in the visible chat experience.
