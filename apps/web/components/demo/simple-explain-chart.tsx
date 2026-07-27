"use client";

/** Close-only path with on-chart labels: price, wall, floor, bias. */
export function SimpleExplainChart({
  series,
  support,
  resistance,
  bias,
  last,
  structure,
}: {
  series: number[];
  support?: number;
  resistance?: number;
  bias?: string;
  last?: number;
  structure?: string;
}) {
  if (series.length < 2) return null;
  const w = 640;
  const h = 200;
  const padX = 28;
  const padY = 28;
  const min = Math.min(...series, support ?? Infinity, resistance ?? Infinity);
  const max = Math.max(
    ...series,
    support ?? -Infinity,
    resistance ?? -Infinity,
  );
  const span = max - min || 1;
  const yAt = (v: number) => padY + (1 - (v - min) / span) * (h - padY * 2);
  const xAt = (i: number) => padX + (i / (series.length - 1)) * (w - padX * 2);
  const pts = series.map((v, i) => `${xAt(i)},${yAt(v)}`);
  const line = pts.join(" ");
  const close = last ?? series[series.length - 1]!;
  const lastX = xAt(series.length - 1);
  const lastY = yAt(close);
  const up = close >= series[0]!;
  const stroke = up ? "#34d399" : "#f87171";
  const uid = `simple-${Math.round(close * 100)}`;
  const money = (n: number) =>
    n >= 100 ? n.toFixed(1) : n >= 10 ? n.toFixed(2) : n.toFixed(3);

  // Keep bias label from overlapping the price callout
  const biasY = Math.min(lastY + 22, h - 10);
  const priceLabelX = Math.max(padX + 8, lastX - 118);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Simple view
          </p>
          <p className="text-xs text-zinc-400">
            Same live data. Price, wall, floor, and bias marked on the path.
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm text-zinc-100">${money(close)}</p>
          {bias && <p className="text-[11px] text-zinc-500">{bias}</p>}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-auto w-full"
        role="img"
        aria-label="Annotated simple price path"
      >
        <defs>
          <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        {resistance != null && (
          <g>
            <line
              x1={padX}
              x2={w - padX}
              y1={yAt(resistance)}
              y2={yAt(resistance)}
              stroke="#f87171"
              strokeOpacity="0.65"
              strokeDasharray="5 4"
              strokeWidth="1.5"
            />
            <rect
              x={padX}
              y={yAt(resistance) - 11}
              width={112}
              height={16}
              rx={3}
              fill="#18181b"
              fillOpacity="0.92"
              stroke="#3f3f46"
              strokeWidth="1"
            />
            <text
              x={padX + 6}
              y={yAt(resistance) + 1}
              fill="#fca5a5"
              fontSize="11"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            >
              {`Wall $${money(resistance)}`}
            </text>
          </g>
        )}

        {support != null && (
          <g>
            <line
              x1={padX}
              x2={w - padX}
              y1={yAt(support)}
              y2={yAt(support)}
              stroke="#34d399"
              strokeOpacity="0.65"
              strokeDasharray="5 4"
              strokeWidth="1.5"
            />
            <rect
              x={padX}
              y={yAt(support) - 11}
              width={118}
              height={16}
              rx={3}
              fill="#18181b"
              fillOpacity="0.92"
              stroke="#3f3f46"
              strokeWidth="1"
            />
            <text
              x={padX + 6}
              y={yAt(support) + 1}
              fill="#6ee7b7"
              fontSize="11"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            >
              {`Floor $${money(support)}`}
            </text>
          </g>
        )}

        <polygon
          points={`${padX},${h - padY} ${line} ${w - padX},${h - padY}`}
          fill={`url(#${uid})`}
        />
        <polyline
          points={line}
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Price here */}
        <circle cx={lastX} cy={lastY} r={4.5} fill={stroke} />
        <circle
          cx={lastX}
          cy={lastY}
          r={8}
          fill="none"
          stroke={stroke}
          strokeOpacity="0.35"
          strokeWidth="1.5"
        />
        <rect
          x={priceLabelX}
          y={lastY - 28}
          width={108}
          height={16}
          rx={3}
          fill="#18181b"
          fillOpacity="0.95"
          stroke="#3f3f46"
          strokeWidth="1"
        />
        <text
          x={priceLabelX + 6}
          y={lastY - 16}
          fill="#e4e4e7"
          fontSize="11"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        >
          {`Price $${money(close)}`}
        </text>

        {bias && (
          <>
            <rect
              x={Math.max(padX, lastX - 150)}
              y={biasY - 4}
              width={Math.min(150, w - padX * 2)}
              height={16}
              rx={3}
              fill="#27272a"
              fillOpacity="0.95"
            />
            <text
              x={Math.max(padX, lastX - 150) + 6}
              y={biasY + 8}
              fill="#a1a1aa"
              fontSize="10"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {bias.length > 28 ? `${bias.slice(0, 26)}…` : bias}
            </text>
          </>
        )}
      </svg>
      {structure && (
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          {structure}
        </p>
      )}
    </div>
  );
}
