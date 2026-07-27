"use client";

/** Simple annotated path for token research: price, attention peak, risk. */
export function SimpleResearchChart({
  series,
  last,
  changePct,
  take,
  attentionNote,
  riskNote,
}: {
  series: number[];
  last?: number;
  changePct?: number;
  take?: string;
  attentionNote?: string;
  riskNote?: string;
}) {
  if (series.length < 2) return null;
  const w = 640;
  const h = 200;
  const padX = 28;
  const padY = 28;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const yAt = (v: number) => padY + (1 - (v - min) / span) * (h - padY * 2);
  const xAt = (i: number) => padX + (i / (series.length - 1)) * (w - padX * 2);

  let peakI = 0;
  for (let i = 1; i < series.length; i++) {
    if (series[i]! > series[peakI]!) peakI = i;
  }

  const pts = series.map((v, i) => `${xAt(i)},${yAt(v)}`);
  const line = pts.join(" ");
  const close = last ?? series[series.length - 1]!;
  const lastX = xAt(series.length - 1);
  const lastY = yAt(close);
  const peakX = xAt(peakI);
  const peakY = yAt(series[peakI]!);
  const up = close >= series[0]!;
  const stroke = up ? "#34d399" : "#f87171";
  const uid = `research-${Math.round(close * 100)}`;
  const money = (n: number) =>
    n >= 100 ? n.toFixed(1) : n >= 10 ? n.toFixed(2) : n.toFixed(3);

  const attentionX = Math.min(Math.max(peakX - 48, padX), w - padX - 120);
  const riskX = Math.min(Math.max(lastX - 130, padX), w - padX - 140);
  const priceLabelX = Math.max(padX + 4, lastX - 112);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Simple view
          </p>
          <p className="text-xs text-zinc-400">
            Same live tape. Price, attention peak, and the main risk marked.
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm text-zinc-100">${money(close)}</p>
          {changePct != null && (
            <p
              className={`text-[11px] ${changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              {changePct >= 0 ? "+" : ""}
              {changePct.toFixed(1)}% · 90d
            </p>
          )}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-auto w-full"
        role="img"
        aria-label="Annotated research price path"
      >
        <defs>
          <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

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

        {/* Attention peak */}
        <line
          x1={peakX}
          x2={peakX}
          y1={peakY}
          y2={h - padY}
          stroke="#a1a1aa"
          strokeOpacity="0.35"
          strokeDasharray="3 4"
          strokeWidth="1"
        />
        <circle cx={peakX} cy={peakY} r={4} fill="#d4d4d8" />
        <rect
          x={attentionX}
          y={Math.max(padY - 6, peakY - 26)}
          width={118}
          height={16}
          rx={3}
          fill="#18181b"
          fillOpacity="0.95"
          stroke="#3f3f46"
          strokeWidth="1"
        />
        <text
          x={attentionX + 6}
          y={Math.max(padY - 6, peakY - 26) + 12}
          fill="#e4e4e7"
          fontSize="11"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        >
          Attention peak
        </text>

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

        {/* Risk callout near now */}
        {riskNote && (
          <>
            <rect
              x={riskX}
              y={Math.min(lastY + 14, h - padY - 4)}
              width={Math.min(148, w - riskX - padX)}
              height={16}
              rx={3}
              fill="#27272a"
              fillOpacity="0.95"
            />
            <text
              x={riskX + 6}
              y={Math.min(lastY + 14, h - padY - 4) + 12}
              fill="#fca5a5"
              fontSize="10"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {riskNote.length > 26 ? `${riskNote.slice(0, 24)}…` : riskNote}
            </text>
          </>
        )}
      </svg>
      {(take || attentionNote) && (
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          {take}
          {attentionNote ? ` ${attentionNote}` : ""}
        </p>
      )}
    </div>
  );
}
