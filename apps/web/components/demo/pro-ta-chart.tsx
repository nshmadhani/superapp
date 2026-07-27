"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import type { OhlcBar } from "@/lib/demo/ta-from-ohlc";
import type { TaAnalysis } from "@/lib/demo/ta-from-ohlc";

function emaSeries(closes: number[], period: number) {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = closes[0] ?? 0;
  for (let i = 0; i < closes.length; i++) {
    const v = closes[i]!;
    prev = i === 0 ? v : v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function ProTaChart({
  candles,
  analysis,
  height = 440,
  meta,
}: {
  candles: OhlcBar[];
  analysis?: TaAnalysis | null;
  height?: number;
  meta?: { source?: string; asOf?: string; candleCount?: number };
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || candles.length === 0) return;

    const chart = createChart(el, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#09090b" },
        textColor: "#a1a1aa",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "#18181b" },
        horzLines: { color: "#18181b" },
      },
      rightPriceScale: { borderColor: "#27272a" },
      timeScale: { borderColor: "#27272a", timeVisible: true },
      crosshair: {
        horzLine: { color: "#52525b", labelBackgroundColor: "#3f3f46" },
        vertLine: { color: "#52525b", labelBackgroundColor: "#3f3f46" },
      },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#f87171",
      borderUpColor: "#34d399",
      borderDownColor: "#f87171",
      wickUpColor: "#34d399",
      wickDownColor: "#f87171",
    }) as ISeriesApi<"Candlestick">;

    candleSeries.setData(
      candles.map((c) => ({
        time: c.time as never,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    const closes = candles.map((c) => c.close);
    const e20 = emaSeries(closes, 20);
    const e50 = emaSeries(closes, 50);

    const ema20 = chart.addSeries(LineSeries, {
      color: "#38bdf8",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "EMA20",
    });
    ema20.setData(
      candles.map((c, i) => ({ time: c.time as never, value: e20[i]! })),
    );

    const ema50 = chart.addSeries(LineSeries, {
      color: "#c084fc",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "EMA50",
    });
    ema50.setData(
      candles.map((c, i) => ({ time: c.time as never, value: e50[i]! })),
    );

    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    vol.setData(
      candles.map((c) => ({
        time: c.time as never,
        value: c.volume ?? 0,
        color:
          c.close >= c.open
            ? "rgba(52, 211, 153, 0.35)"
            : "rgba(248, 113, 113, 0.35)",
      })),
    );

    if (analysis) {
      for (const lvl of analysis.levels.resistance) {
        candleSeries.createPriceLine({
          price: lvl,
          color: "rgba(248, 113, 113, 0.7)",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "R",
        });
      }
      for (const lvl of analysis.levels.support) {
        candleSeries.createPriceLine({
          price: lvl,
          color: "rgba(52, 211, 153, 0.7)",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "S",
        });
      }
      candleSeries.createPriceLine({
        price: analysis.levels.invalidation,
        color: "rgba(250, 204, 21, 0.85)",
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: "Inv",
      });
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (!wrapRef.current) return;
      chart.applyOptions({ width: wrapRef.current.clientWidth });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, analysis, height, meta?.asOf, meta?.candleCount]);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Working chart (real data)
          </p>
          <p className="text-xs text-zinc-400">
            Daily candles, EMA20/50, volume, support and resistance lines
          </p>
        </div>
        <div className="text-right text-[10px] uppercase tracking-wide text-zinc-600">
          <p>
            {meta?.candleCount ?? candles.length} days · CoinGecko live
          </p>
          {meta?.asOf && (
            <p className="normal-case tracking-normal text-zinc-700">
              as of {new Date(meta.asOf).toLocaleString()}
            </p>
          )}
        </div>
      </div>
      <div ref={wrapRef} className="w-full" style={{ height }} />
      {analysis && (
        <div className="grid gap-2 border-t border-zinc-800 px-3 py-2 sm:grid-cols-2">
          {analysis.zones.map((z) => (
            <div
              key={`${z.kind}-${z.label}`}
              className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-2.5 py-1.5 text-[11px]"
            >
              <span
                className={
                  z.kind === "support"
                    ? "text-emerald-400"
                    : z.kind === "resistance"
                      ? "text-red-400"
                      : z.kind === "invalidation"
                        ? "text-amber-300"
                        : "text-sky-300"
                }
              >
                {z.label}
              </span>
              <span className="ml-2 font-mono text-zinc-400">
                ${z.from.toFixed(2)} - ${z.to.toFixed(2)}
              </span>
              <span className="ml-2 text-zinc-600">{z.kind}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
