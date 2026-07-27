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
  dataNote: string;
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

  const resistance =
    resAll.length > 0
      ? resAll
      : [last * 1.05, last * 1.12, high90].filter(
          (v, i, a) => a.indexOf(v) === i,
        );
  const support =
    supAll.length > 0
      ? supAll
      : [last * 0.95, last * 0.88, low90].filter(
          (v, i, a) => a.indexOf(v) === i,
        );

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

  let structure = "Mostly rangebound";
  let bias = "Wait for a clear break";
  if (belowBoth && lowerHighs) {
    structure = "Lower highs, price under the averages";
    bias = "Lean short on strength";
  } else if (aboveBoth && higherLows) {
    structure = "Higher lows, price above the averages";
    bias = "Lean long on dips";
  } else if (belowBoth) {
    structure = "Price under the key averages";
    bias = "Cautious short bias";
  } else if (aboveBoth) {
    structure = "Price above the key averages";
    bias = "Cautious long bias";
  }

  const vols = bars.map((b) => b.volume ?? 0);
  const avg20 =
    vols.slice(-20).reduce((a, b) => a + b, 0) /
    Math.max(Math.min(20, vols.length), 1);
  const lastVol = vols[vols.length - 1] ?? 0;
  const volDelta = avg20 ? ((lastVol - avg20) / avg20) * 100 : 0;

  const r1 = resistance[0] ?? last * 1.05;
  const r2 = resistance[1] ?? last * 1.12;
  const s1 = support[0] ?? last * 0.95;
  const s2 = support[1] ?? last * 0.88;
  const invalidation = bias.includes("short")
    ? Math.max(...resistance.slice(-1), ema50)
    : bias.includes("long")
      ? Math.min(...support.slice(-1), ema50)
      : ema50;

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

  const plainEnglish = bias.includes("short")
    ? `Sellers still have control. I would rather sell a bounce near $${fmt(r1)} than chase the lows. If price closes and holds above $${fmt(invalidation)}, that read is wrong.`
    : bias.includes("long")
      ? `Buyers still have control. I would rather buy strength that holds near $${fmt(s1)}. If price closes and holds under $${fmt(invalidation)}, that read is wrong.`
      : `No clean edge yet. Wait for a daily hold above $${fmt(r1)} or under $${fmt(s1)} before sizing.`;

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
          ? "Latest days are quieter than usual"
          : volDelta > 20
            ? "Latest days are louder than usual"
            : "Volume is roughly average",
      vs20dAvg: `${volDelta >= 0 ? "+" : ""}${volDelta.toFixed(0)}%`,
    },
    risk: {
      entryZone: bias.includes("short")
        ? `near $${fmt(r1)}`
        : bias.includes("long")
          ? `near $${fmt(s1)}`
          : "after a break",
      stop: `beyond $${fmt(invalidation)}`,
      targets: bias.includes("short")
        ? `$${fmt(s1)}, then $${fmt(s2)}`
        : `$${fmt(r1)}, then $${fmt(r2)}`,
      rr: "about 1.5 to 2.5R",
    },
    plainEnglish,
    dataNote: `${bars.length} daily candles from live CoinGecko prices`,
  };
}

/** Short, plain explanation after the complex chart. No em dashes. */
export function buildTaWriteup(a: TaAnalysis): string {
  const f = (n: number) =>
    n >= 100 ? n.toFixed(1) : n >= 10 ? n.toFixed(2) : n.toFixed(3);

  return `Okay, simple version.

We pulled **live HYPE prices from CoinGecko** and built **${a.dataNote}**. The chart above is the desk view: candles, EMA20/EMA50, volume, and the levels we marked.

**What it says**
${a.structure}. Last price is **$${f(a.last)}**. Over this window it went from about **$${f(a.low90)}** to **$${f(a.high90)}** (${a.changePct90 >= 0 ? "+" : ""}${a.changePct90.toFixed(1)}%).

**Bias:** ${a.bias}

${a.plainEnglish}

**If you act on it**
- Watch / enter: ${a.risk.entryZone}
- Stop: ${a.risk.stop}
- Targets: ${a.risk.targets}
- RSI is ${a.indicators.rsi14}. EMA20 is $${f(a.indicators.ema20)}. EMA50 is $${f(a.indicators.ema50)}.

Not a guarantee. The chart is the evidence. This paragraph is just the read.`;
}
