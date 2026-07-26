export type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

const BINANCE_SYMBOLS: Record<string, string> = {
  eth: "ETHUSDT",
  ethereum: "ETHUSDT",
  btc: "BTCUSDT",
  bitcoin: "BTCUSDT",
  sol: "SOLUSDT",
  solana: "SOLUSDT",
  link: "LINKUSDT",
  uni: "UNIUSDT",
  aave: "AAVEUSDT",
};

export function resolveBinanceSymbol(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (BINANCE_SYMBOLS[key]) return BINANCE_SYMBOLS[key];
  if (/^[a-z0-9]+usdt$/.test(key)) return key.toUpperCase();
  return `${key.toUpperCase()}USDT`;
}

/** Public Binance spot klines — no API key. */
export async function fetchBinanceKlines(
  symbol: string,
  interval = "1d",
  limit = 90,
): Promise<Candle[]> {
  const url = new URL("https://api.binance.com/api/v3/klines");
  url.searchParams.set("symbol", resolveBinanceSymbol(symbol));
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`binance_klines_${res.status}`);
  const rows = (await res.json()) as unknown[];
  if (!Array.isArray(rows)) throw new Error("binance_klines_shape");
  return rows.map((row) => {
    const r = row as unknown[];
    return {
      t: Number(r[0]),
      o: Number(r[1]),
      h: Number(r[2]),
      l: Number(r[3]),
      c: Number(r[4]),
      v: Number(r[5]),
    };
  });
}
