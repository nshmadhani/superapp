export type OhlcBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type TaAnalysis = {
  type: "ta_snapshot";
  symbol: string;
  timeframe: string;
  structure: string;
  bias: string;
  last: number;
  changePct90: number;
  high90: number;
  low90: number;
  indicators: {
    rsi14: number;
    ema20: number;
    ema50: number;
    atr14: number;
  };
  levels: {
    resistance: number[];
    support: number[];
    invalidation: number;
  };
  zones: Array<{
    kind: "support" | "resistance" | "entry" | "invalidation";
    from: number;
    to: number;
    label: string;
  }>;
  volume: {
    note: string;
    vs20dAvg: string;
  };
  risk: {
    entryZone: string;
    stop: string;
    targets: string;
    rr: string;
  };
  plainEnglish: string;
};

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0] ?? 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    prev = i === 0 ? v : v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i]! - closes[i - 1]!;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const ag = gains / period;
  const al = losses / period;
  if (al === 0) return 100;
  const rs = ag / al;
  return 100 - 100 / (1 + rs);
}

function atr(bars: OhlcBar[], period = 14): number {
  if (bars.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i]!;
    const prev = bars[i - 1]!;
    trs.push(
      Math.max(
        b.high - b.low,
        Math.abs(b.high - prev.close),
        Math.abs(b.low - prev.close),
      ),
    );
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / Math.max(slice.length, 1);
}

function swingLevels(bars: OhlcBar[], lookback = 3) {
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    const h = bars[i]!.high;
    const l = bars[i]!.low;
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (bars[i - j]!.high >= h || bars[i + j]!.high >= h) isHigh = false;
      if (bars[i - j]!.low <= l || bars[i + j]!.low <= l) isLow = false;
    }
    if (isHigh) highs.push(h);
    if (isLow) lows.push(l);
  }
  return { highs, lows };
}

function cluster(levels: number[], tolPct: number): number[] {
  if (!levels.length) return [];
  const sorted = [...levels].sort((a, b) => a - b);
  const groups: number[][] = [[sorted[0]!]];
  for (let i = 1; i < sorted.length; i++) {
    const v = sorted[i]!;
    const g = groups[groups.length - 1]!;
    const anchor = g[0]!;
    if (Math.abs(v - anchor) / anchor <= tolPct) g.push(v);
    else groups.push([v]);
  }
  return groups
    .map((g) => g.reduce((a, b) => a + b, 0) / g.length)
    .sort((a, b) => a - b);
}

export function analyzeOhlc(
  bars: OhlcBar[],
  opts: { symbol: string; timeframe?: string },
): TaAnalysis {
  const closes = bars.map((b) => b.close);
  const last = closes[closes.length - 1] ?? 0;
  const first = closes[0] ?? last;
  const high90 = Math.max(...bars.map((b) => b.high));
  const low90 = Math.min(...bars.map((b) => b.low));
  const changePct90 = first ? ((last - first) / first) * 100 : 0;

  const ema20Arr = ema(closes, 20);
  const ema50Arr = ema(closes, 50);
  const ema20 = ema20Arr[ema20Arr.length - 1] ?? last;
  const ema50 = ema50Arr[ema50Arr.length - 1] ?? last;
  const rsi14 = rsi(closes, 14);
  const atr14 = atr(bars, 14);

  const { highs, lows } = swingLevels(bars, 2);
  const resAll = cluster(
    highs.filter((h) => h > last),
    0.025,
  ).slice(-3);
  const supAll = cluster(
    lows.filter((l) => l < last),
    0.025,
  )
    .slice(0, 3)
    .reverse();

  // Ensure we always have useful levels near price
  const resistance =
    resAll.length > 0
      ? resAll
      : [last * 1.05, last * 1.12, high90].filter((v, i, a) => a.indexOf(v) === i);
  const support =
    supAll.length > 0
      ? supAll
      : [last * 0.95, last * 0.88, low90].filter((v, i, a) => a.indexOf(v) === i);

  const belowBoth = last < ema20 && last < ema50;
  const aboveBoth = last > ema20 && last > ema50;
  const lowerHighs =
    highs.length >= 3 &&
    highs[highs.length - 1]! < highs[highs.length - 2]! &&
    highs[highs.length - 2]! < highs[highs.length - 3]!;
  const higherLows =
    lows.length >= 3 &&
    lows[lows.length - 1]! > lows[lows.length - 2]! &&
    lows[lows.length - 2]! > lows[lows.length - 3]!;

  let structure = "Range / chop";
  let bias = "Neutral — wait";
  if (belowBoth && lowerHighs) {
    structure = "Lower highs · price below EMAs (downtrend)";
    bias = "Short on weakness";
  } else if (aboveBoth && higherLows) {
    structure = "Higher lows · price above EMAs (uptrend)";
    bias = "Long on strength";
  } else if (belowBoth) {
    structure = "Below key EMAs — bearish bias";
    bias = "Short / cautious";
  } else if (aboveBoth) {
    structure = "Above key EMAs — bullish bias";
    bias = "Long / cautious";
  }

  const vols = bars.map((b) => b.volume ?? 0);
  const avg20 =
    vols.slice(-20).reduce((a, b) => a + b, 0) / Math.max(Math.min(20, vols.length), 1);
  const lastVol = vols[vols.length - 1] ?? 0;
  const volDelta = avg20 ? ((lastVol - avg20) / avg20) * 100 : 0;

  const r1 = resistance[0] ?? last * 1.05;
  const r2 = resistance[1] ?? last * 1.12;
  const s1 = support[0] ?? last * 0.95;
  const s2 = support[1] ?? last * 0.88;
  const invalidation =
    bias.startsWith("Short") ? Math.max(...resistance.slice(-1), ema50) : Math.min(...support.slice(-1), ema50);

  const zones: TaAnalysis["zones"] = [
    {
      kind: "resistance",
      from: r1 * 0.992,
      to: r1 * 1.008,
      label: "R1",
    },
    {
      kind: "support",
      from: s1 * 0.992,
      to: s1 * 1.008,
      label: "S1",
    },
    {
      kind: "entry",
      from: Math.min(last, r1) * 0.99,
      to: Math.max(last, r1) * 1.01,
      label: "Watch",
    },
    {
      kind: "invalidation",
      from: invalidation * 0.995,
      to: invalidation * 1.005,
      label: "Invalidation",
    },
  ];

  const fmt = (n: number) =>
    n >= 100 ? n.toFixed(1) : n >= 10 ? n.toFixed(2) : n.toFixed(3);

  const plainEnglish =
    bias.startsWith("Short")
      ? `Price is grinding under the trend averages. Prefer fading strength into ~$${fmt(r1)} rather than chasing the lows. Invalidation is a sustained reclaim through ~$${fmt(invalidation)}.`
      : bias.startsWith("Long")
        ? `Price holds above the trend averages. Prefer buying strength / dips that hold ~$${fmt(s1)}. Invalidation is a break and hold under ~$${fmt(invalidation)}.`
        : `No clean trend edge. Wait for a break and hold of ~$${fmt(r1)} or ~$${fmt(s1)} before sizing.`;

  return {
    type: "ta_snapshot",
    symbol: opts.symbol,
    timeframe: opts.timeframe ?? "1D",
    structure,
    bias,
    last,
    changePct90,
    high90,
    low90,
    indicators: {
      rsi14: Math.round(rsi14 * 10) / 10,
      ema20: Math.round(ema20 * 100) / 100,
      ema50: Math.round(ema50 * 100) / 100,
      atr14: Math.round(atr14 * 100) / 100,
    },
    levels: {
      resistance: resistance.map((n) => Math.round(n * 100) / 100),
      support: support.map((n) => Math.round(n * 100) / 100),
      invalidation: Math.round(invalidation * 100) / 100,
    },
    zones,
    volume: {
      note:
        volDelta < -15
          ? "Recent bars quieter than average — weak participation on moves"
          : volDelta > 20
            ? "Recent bars louder than average — conviction in the last move"
            : "Volume near average — no strong participation edge",
      vs20dAvg: `${volDelta >= 0 ? "+" : ""}${volDelta.toFixed(0)}%`,
    },
    risk: {
      entryZone: bias.startsWith("Short")
        ? `fade $${fmt(last)}–$${fmt(r1)}`
        : bias.startsWith("Long")
          ? `hold/dip $${fmt(s1)}–$${fmt(last)}`
          : "wait for break",
      stop: `beyond $${fmt(invalidation)}`,
      targets: bias.startsWith("Short")
        ? `$${fmt(s1)} then $${fmt(s2)}`
        : `$${fmt(r1)} then $${fmt(r2)}`,
      rr: "~1.5–2.5R depending on entry",
    },
    plainEnglish,
  };
}

export function buildTaWriteup(a: TaAnalysis): string {
  const f = (n: number) =>
    n >= 100 ? n.toFixed(1) : n >= 10 ? n.toFixed(2) : n.toFixed(3);

  return `**${a.symbol} · daily technical analysis** *(live CoinGecko OHLC)*

The chart above is the **working tape** — candles, EMAs, volume, and boxed levels traders actually mark. Below is the **plain read** for decision-making.

### What’s on the chart
- **Candles:** last ~90d real OHLC from CoinGecko  
- **EMA20 / EMA50:** trend filter overlays  
- **Boxes:** support / resistance / invalidation zones derived from swing pivots  
- **Volume pane:** relative activity (derived when the feed lacks raw volume)

### Structure
${a.structure}

**Last** $${f(a.last)} · **90d range** $${f(a.low90)}–$${f(a.high90)} (${a.changePct90 >= 0 ? "+" : ""}${a.changePct90.toFixed(1)}%)

### Indicators
| | |
|---|---|
| RSI(14) | **${a.indicators.rsi14}** |
| EMA20 | **$${f(a.indicators.ema20)}** |
| EMA50 | **$${f(a.indicators.ema50)}** |
| ATR(14) | **$${f(a.indicators.atr14)}** |

### Levels
| | |
|---|---|
| Resistance | ${a.levels.resistance.map((l) => `$${f(l)}`).join(" · ")} |
| Support | ${a.levels.support.map((l) => `$${f(l)}`).join(" · ")} |
| Invalidation | **$${f(a.levels.invalidation)}** |

### Volume
${a.volume.note} (${a.volume.vs20dAvg} vs ~20-bar avg)

### Inference
**Bias: ${a.bias}**

${a.plainEnglish}

- **Plan:** ${a.risk.entryZone}  
- **Stop:** ${a.risk.stop}  
- **Targets:** ${a.risk.targets}  
- **RR:** ${a.risk.rr}

This is a **framework from live data**, not a prediction guarantee — invalidate when structure says so.`;
}
