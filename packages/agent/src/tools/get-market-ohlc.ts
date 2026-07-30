import { tool } from "ai";
import { z } from "zod";
import { fetchBinanceKlines, resolveBinanceSymbol } from "@ervo/agent-jobs";

/**
 * Live spot OHLCV from Binance public API — use for prices / TA in chat.
 */
export function getMarketOhlcTool() {
  return tool({
    description:
      "Fetch live spot OHLCV candles from Binance (no API key). Use this for current prices, TA, support/resistance, and any market-level price question. Do not invent prices or rely on web_search for candle data.",
    inputSchema: z.object({
      symbol: z
        .string()
        .describe("Asset symbol, e.g. ETH, BTC, SOL, or ETHUSDT"),
      interval: z
        .enum(["1m", "5m", "15m", "1h", "4h", "1d", "1w"])
        .optional()
        .describe("Candle interval (default 1d)"),
      limit: z
        .number()
        .int()
        .min(10)
        .max(500)
        .optional()
        .describe("Number of candles (default 90)"),
    }),
    execute: async ({ symbol, interval, limit }) => {
      try {
        const resolved = resolveBinanceSymbol(symbol);
        const candles = await fetchBinanceKlines(
          resolved,
          interval ?? "1d",
          limit ?? 90,
        );
        if (!candles.length) {
          return { error: "no_candles", symbol: resolved };
        }
        const last = candles[candles.length - 1]!;
        return {
          symbol: resolved,
          interval: interval ?? "1d",
          count: candles.length,
          lastClose: last.c,
          lastOpenTime: last.t,
          lastOpenTimeIso: new Date(last.t).toISOString(),
          candles,
        };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "ohlc_failed",
          symbol,
        };
      }
    },
  });
}
