import { NextResponse } from "next/server";

export type OhlcBar = {
  time: number; // unix seconds (UTC day)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type ChartPayload = {
  prices: [number, number][];
  total_volumes: [number, number][];
};

/** Bucket CoinGecko market_chart points into real daily OHLC. */
function toDailyOhlc(chart: ChartPayload): OhlcBar[] {
  const byDay = new Map<
    number,
    { open: number; high: number; low: number; close: number; volume: number }
  >();

  for (const [ms, price] of chart.prices ?? []) {
    const day = Math.floor(ms / 86_400_000) * 86_400;
    const row = byDay.get(day);
    if (!row) {
      byDay.set(day, {
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0,
      });
    } else {
      row.high = Math.max(row.high, price);
      row.low = Math.min(row.low, price);
      row.close = price;
    }
  }

  for (const [ms, vol] of chart.total_volumes ?? []) {
    const day = Math.floor(ms / 86_400_000) * 86_400;
    const row = byDay.get(day);
    if (row) row.volume += vol;
  }

  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, row]) => ({
      time: day,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
    }));
}

/**
 * Live HYPE (or other) daily candles from CoinGecko market_chart.
 * No API key. Aggregated to 1D OHLC so the desk chart has real density.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const coin = url.searchParams.get("coin") ?? "hyperliquid";
  const days = url.searchParams.get("days") ?? "90";
  const vs = url.searchParams.get("vs") ?? "usd";

  try {
    const cg = await fetch(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coin)}/market_chart?vs_currency=${encodeURIComponent(vs)}&days=${encodeURIComponent(days)}`,
      {
        headers: { accept: "application/json" },
        next: { revalidate: 300 },
      },
    );

    if (!cg.ok) {
      const text = await cg.text();
      return NextResponse.json(
        { error: `CoinGecko ${cg.status}`, detail: text.slice(0, 200) },
        { status: 502 },
      );
    }

    const chart = (await cg.json()) as ChartPayload;
    const candles = toDailyOhlc(chart);

    if (!candles.length) {
      return NextResponse.json(
        { error: "No candles built from market_chart" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      source: "coingecko_market_chart",
      coin,
      vs,
      days: Number(days),
      interval: "1d",
      candleCount: candles.length,
      candles,
      asOf: new Date().toISOString(),
      note: "Daily OHLC built from live CoinGecko market_chart prices and volumes",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to fetch OHLC",
      },
      { status: 500 },
    );
  }
}
