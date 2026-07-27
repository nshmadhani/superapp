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
  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          TA snapshot · {snap.symbol} · {snap.timeframe}
        </p>
        <p className="text-xs text-zinc-300">{snap.structure}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Bias" value={snap.bias} emphasis />
        <Metric label="RSI(14)" value={snap.indicators.rsi14.toFixed(1)} />
        <Metric label="EMA20" value={`$${snap.indicators.ema20.toFixed(2)}`} />
        <Metric label="EMA50" value={`$${snap.indicators.ema50.toFixed(2)}`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-zinc-600">
            Resistance
          </p>
          <ul className="space-y-0.5 font-mono text-xs text-zinc-300">
            {snap.levels.resistance.map((lvl) => (
              <li key={`r-${lvl}`}>${lvl.toFixed(2)}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-zinc-600">
            Support
          </p>
          <ul className="space-y-0.5 font-mono text-xs text-zinc-300">
            {snap.levels.support.map((lvl) => (
              <li key={`s-${lvl}`}>${lvl.toFixed(2)}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-zinc-800/80 pt-2 text-xs text-zinc-400">
        <p>
          <span className="text-zinc-500">Volume · </span>
          {snap.volume.note}{" "}
          <span className="font-mono text-zinc-500">({snap.volume.vs20dAvg})</span>
        </p>
        <p className="mt-1.5">
          <span className="text-zinc-500">Risk · </span>
          Entry {snap.risk.entryZone} · Stop {snap.risk.stop} · Targets{" "}
          {snap.risk.targets} · {snap.risk.rr}
        </p>
        <p className="mt-1 font-mono text-[11px] text-zinc-600">
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
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-lg bg-zinc-950/50 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-zinc-600">{label}</p>
      <p
        className={`mt-0.5 text-sm ${emphasis ? "font-medium text-zinc-100" : "font-mono text-zinc-200"}`}
      >
        {value}
      </p>
    </div>
  );
}
