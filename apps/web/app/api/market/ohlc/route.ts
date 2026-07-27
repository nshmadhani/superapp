import { NextResponse } from "next/server";

export type OhlcBar = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

/**
 * Public market OHLC via CoinGecko (no API key for demo rates).
 * Used by the seeded TA chat for real candles.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const coin = url.searchParams.get("coin") ?? "hyperliquid";
  const days = url.searchParams.get("days") ?? "90";
  const vs = url.searchParams.get("vs") ?? "usd";

  try {
    const cg = await fetch(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coin)}/ohlc?vs_currency=${encodeURIComponent(vs)}&days=${encodeURIComponent(days)}`,
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

    const raw = (await cg.json()) as number[][];
    const candles: OhlcBar[] = raw.map((row) => ({
      time: Math.floor(row[0]! / 1000),
      open: row[1]!,
      high: row[2]!,
      low: row[3]!,
      close: row[4]!,
    }));

    // CoinGecko OHLC has no volume — approximate relative volume from range
    // for chart pane context only (labeled as derived in UI).
    const withVol = candles.map((c, i) => {
      const range = Math.max(c.high - c.low, 1e-9);
      const body = Math.abs(c.close - c.open);
      const prev = candles[i - 1];
      const gap = prev ? Math.abs(c.open - prev.close) : 0;
      return {
        ...c,
        volume: range * 1e6 + body * 5e5 + gap * 2e5,
      };
    });

    return NextResponse.json({
      source: "coingecko",
      coin,
      vs,
      days: Number(days),
      candles: withVol,
      asOf: new Date().toISOString(),
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
