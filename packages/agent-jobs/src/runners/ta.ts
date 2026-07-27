import { e2bConfigured, parseJsonFromE2bText, runInE2b } from "../e2b";
import { fetchBinanceKlines, resolveBinanceSymbol } from "../market-data";
import type { TaArtifact } from "../types";

export async function runTaJob(
  goal: string,
  policy: Record<string, unknown>,
): Promise<{ artifact: TaArtifact; source: "live" | "fallback"; sandboxId?: string }> {
  const symbol = String(policy.symbol ?? inferSymbol(goal) ?? "ETH");
  const interval = String(policy.interval ?? "1d");

  const candles = await fetchBinanceKlines(symbol, interval, 90);
  if (!candles.length) {
    throw new Error(`binance_klines_empty:${resolveBinanceSymbol(symbol)}`);
  }

  if (!e2bConfigured()) {
    return {
      artifact: analyzeLocally(symbol, interval, candles),
      source: "live",
    };
  }

  const closes = candles.map((c) => c.c);
  const times = candles.map((c) => c.t);
  const code = `
import json
closes = ${JSON.stringify(closes)}
times = ${JSON.stringify(times)}
symbol = ${JSON.stringify(resolveBinanceSymbol(symbol))}
interval = ${JSON.stringify(interval)}

def sma(xs, n):
    if len(xs) < n: return None
    return sum(xs[-n:]) / n

def rsi(xs, n=14):
    if len(xs) <= n: return None
    gains = []
    losses = []
    for i in range(-n, 0):
        d = xs[i] - xs[i-1]
        gains.append(max(d, 0))
        losses.append(max(-d, 0))
    ag = sum(gains) / n
    al = sum(losses) / n
    if al == 0: return 100.0
    rs = ag / al
    return 100 - (100 / (1 + rs))

sma20 = sma(closes, 20)
sma50 = sma(closes, 50)
rsi14 = rsi(closes, 14)
last = closes[-1]
bias = "neutral"
conf = 0.45
if sma20 is not None and sma50 is not None and rsi14 is not None:
    if last > sma20 > sma50 and rsi14 < 70:
        bias, conf = "long", 0.62
    elif last < sma20 < sma50 and rsi14 > 30:
        bias, conf = "short", 0.62
    elif rsi14 >= 70:
        bias, conf = "short", 0.55
    elif rsi14 <= 30:
        bias, conf = "long", 0.55

series = [{"t": int(t), "c": float(c)} for t, c in zip(times[-60:], closes[-60:])]
summary = f"{symbol} {interval}: bias={bias}, RSI14={None if rsi14 is None else round(rsi14,1)}, last={round(last,4)}"
out = {
  "kind": "ta",
  "symbol": symbol,
  "interval": interval,
  "bias": bias,
  "confidence": conf,
  "summary": summary,
  "indicators": {
    "sma20": sma20,
    "sma50": sma50,
    "rsi14": rsi14,
    "lastClose": last,
  },
  "series": series,
}
print(json.dumps(out))
`;

  try {
    const exec = await runInE2b(code);
    const artifact = parseJsonFromE2bText<TaArtifact>(exec.text);
    if (artifact.kind !== "ta") throw new Error("bad_artifact");
    return { artifact, source: "live", sandboxId: exec.sandboxId };
  } catch {
    return {
      artifact: analyzeLocally(symbol, interval, candles),
      source: "live",
    };
  }
}

function inferSymbol(goal: string): string | null {
  const m = goal.match(/\b(ETH|BTC|SOL|LINK|UNI|AAVE|WETH)\b/i);
  return m ? m[1]!.toUpperCase() : null;
}

function analyzeLocally(
  symbol: string,
  interval: string,
  candles: Array<{ t: number; c: number }>,
): TaArtifact {
  const closes = candles.map((c) => c.c);
  const sma = (n: number) =>
    closes.length >= n
      ? closes.slice(-n).reduce((a, b) => a + b, 0) / n
      : undefined;
  const sma20 = sma(20);
  const sma50 = sma(50);
  const last = closes[closes.length - 1] ?? 0;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    if (i <= 0) continue;
    const d = closes[i]! - closes[i - 1]!;
    if (d >= 0) gains += d;
    else losses -= d;
  }
  const ag = gains / 14;
  const al = losses / 14;
  const rsi14 = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  let bias: TaArtifact["bias"] = "neutral";
  let confidence = 0.45;
  if (sma20 != null && sma50 != null) {
    if (last > sma20 && sma20 > sma50 && rsi14 < 70) {
      bias = "long";
      confidence = 0.6;
    } else if (last < sma20 && sma20 < sma50 && rsi14 > 30) {
      bias = "short";
      confidence = 0.6;
    }
  }
  return {
    kind: "ta",
    symbol: resolveBinanceSymbol(symbol),
    interval,
    bias,
    confidence,
    summary: `${symbol} ${interval}: bias=${bias}, RSI14=${rsi14.toFixed(1)}, last=${last}`,
    indicators: { sma20, sma50, rsi14, lastClose: last },
    series: candles.slice(-60).map((c) => ({ t: c.t, c: c.c })),
  };
}
