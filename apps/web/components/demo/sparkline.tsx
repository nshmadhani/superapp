"use client";

export function PriceChart({
  series,
  className,
}: {
  series: number[];
  className?: string;
}) {
  if (!series.length) return null;
  const w = 640;
  const h = 220;
  const pad = 16;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const pts = series.map((v, i) => {
    const x = pad + (i / (series.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return `${x},${y}`;
  });
  const line = pts.join(" ");
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
  const last = series[series.length - 1]!;
  const first = series[0]!;
  const up = last >= first;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-auto w-full"
        role="img"
        aria-label="Price chart"
      >
        <defs>
          <linearGradient id="taFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={up ? "#34d399" : "#f87171"}
              stopOpacity="0.35"
            />
            <stop
              offset="100%"
              stopColor={up ? "#34d399" : "#f87171"}
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#taFill)" />
        <polyline
          points={line}
          fill="none"
          stroke={up ? "#34d399" : "#f87171"}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-zinc-600">
        <span>90d</span>
        <span className="font-mono text-zinc-400">${last.toFixed(2)}</span>
      </div>
    </div>
  );
}
