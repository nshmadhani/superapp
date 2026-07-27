"use client";

export type TaSnapshot = {
  type: "ta_snapshot";
  symbol: string;
  timeframe: string;
  structure: string;
  bias: string;
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
};

export function DemoTaCard({ snap }: { snap: TaSnapshot }) {
  const shortBias = /short/i.test(snap.bias);

  return (
    <div className="space-y-3 rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-zinc-900/80 to-zinc-950 px-3 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-violet-300/80">
          TA snapshot · {snap.symbol} · {snap.timeframe}
        </p>
        <p className="text-xs text-zinc-300">{snap.structure}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          label="Bias"
          value={snap.bias}
          emphasis
          tone={shortBias ? "rose" : "emerald"}
        />
        <Metric
          label="RSI(14)"
          value={snap.indicators.rsi14.toFixed(1)}
          tone="amber"
        />
        <Metric
          label="EMA20"
          value={`$${snap.indicators.ema20.toFixed(2)}`}
          tone="sky"
        />
        <Metric
          label="EMA50"
          value={`$${snap.indicators.ema50.toFixed(2)}`}
          tone="indigo"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-2.5 py-2">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-rose-300/80">
            Resistance
          </p>
          <ul className="space-y-0.5 font-mono text-xs text-rose-100/90">
            {snap.levels.resistance.map((lvl) => (
              <li key={`r-${lvl}`}>${lvl.toFixed(2)}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-emerald-300/80">
            Support
          </p>
          <ul className="space-y-0.5 font-mono text-xs text-emerald-100/90">
            {snap.levels.support.map((lvl) => (
              <li key={`s-${lvl}`}>${lvl.toFixed(2)}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-zinc-800/80 pt-2 text-xs text-zinc-400">
        <p>
          <span className="text-amber-400/80">Volume · </span>
          {snap.volume.note}{" "}
          <span className="font-mono text-amber-200/70">
            ({snap.volume.vs20dAvg})
          </span>
        </p>
        <p className="mt-1.5">
          <span className="text-sky-400/80">Risk · </span>
          Entry {snap.risk.entryZone} · Stop {snap.risk.stop} · Targets{" "}
          {snap.risk.targets} · {snap.risk.rr}
        </p>
        <p className="mt-1 font-mono text-[11px] text-zinc-500">
          Invalidation ${snap.levels.invalidation.toFixed(2)} · ATR(14) $
          {snap.indicators.atr14.toFixed(2)}
        </p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  emphasis,
  tone = "zinc",
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: "zinc" | "rose" | "emerald" | "amber" | "sky" | "indigo";
}) {
  const toneClass = {
    zinc: "border-zinc-800 bg-zinc-950/50",
    rose: "border-rose-500/25 bg-rose-500/10",
    emerald: "border-emerald-500/25 bg-emerald-500/10",
    amber: "border-amber-500/25 bg-amber-500/10",
    sky: "border-sky-500/25 bg-sky-500/10",
    indigo: "border-indigo-500/25 bg-indigo-500/10",
  }[tone];
  const valueClass = {
    zinc: emphasis ? "text-zinc-100" : "text-zinc-200",
    rose: "text-rose-100",
    emerald: "text-emerald-100",
    amber: "text-amber-100",
    sky: "text-sky-100",
    indigo: "text-indigo-100",
  }[tone];

  return (
    <div className={`rounded-lg border px-2.5 py-2 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={`mt-0.5 text-sm ${emphasis ? "font-medium" : "font-mono"} ${valueClass}`}
      >
        {value}
      </p>
    </div>
  );
}
