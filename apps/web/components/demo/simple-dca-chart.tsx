"use client";

export type DcaWeekMark = {
  label: string;
  status: "bought" | "skipped" | "next" | "future";
  detail?: string;
  ethPrice?: number;
};

/** Annotated weekly DCA schedule: buys, skips, next run. */
export function SimpleDcaChart({
  weeks,
  priceSeries,
  take,
}: {
  weeks: DcaWeekMark[];
  priceSeries?: number[];
  take?: string;
}) {
  const w = 640;
  const h = 200;
  const padX = 28;
  const padY = 36;
  const n = Math.max(weeks.length, 2);

  const prices =
    priceSeries && priceSeries.length >= 2
      ? priceSeries
      : weeks.map((wk, i) => 3200 + i * 40 + (wk.status === "skipped" ? 180 : 0));

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const yAt = (v: number) => padY + (1 - (v - min) / span) * (h - padY * 2 - 24);
  const xAt = (i: number) => padX + (i / (n - 1)) * (w - padX * 2);

  // Sample price path across weeks
  const pathPts = weeks
    .map((_, i) => {
      const pi = Math.round((i / (n - 1)) * (prices.length - 1));
      return `${xAt(i)},${yAt(prices[pi]!)}`;
    })
    .join(" ");

  const statusColor = (s: DcaWeekMark["status"]) => {
    switch (s) {
      case "bought":
        return "#34d399";
      case "skipped":
        return "#fbbf24";
      case "next":
        return "#38bdf8";
      default:
        return "#52525b";
    }
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Simple view
          </p>
          <p className="text-xs text-zinc-400">
            Weekly runs on one path. Buys, the skip, and what is next.
          </p>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-auto w-full"
        role="img"
        aria-label="Annotated DCA schedule"
      >
        <polyline
          points={pathPts}
          fill="none"
          stroke="#71717a"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeOpacity="0.7"
        />

        {weeks.map((wk, i) => {
          const x = xAt(i);
          const pi = Math.round((i / (n - 1)) * (prices.length - 1));
          const y = yAt(prices[pi]!);
          const color = statusColor(wk.status);
          const labelY =
            wk.status === "skipped"
              ? Math.max(14, y - 28)
              : wk.status === "next"
                ? Math.min(h - 18, y + 22)
                : Math.max(14, y - 26);

          return (
            <g key={`${wk.label}-${i}`}>
              <line
                x1={x}
                x2={x}
                y1={y}
                y2={h - 18}
                stroke={color}
                strokeOpacity="0.35"
                strokeDasharray="3 4"
                strokeWidth="1"
              />
              <circle
                cx={x}
                cy={y}
                r={wk.status === "next" ? 5.5 : 4.5}
                fill={color}
              />
              {wk.status === "next" && (
                <circle
                  cx={x}
                  cy={y}
                  r={9}
                  fill="none"
                  stroke={color}
                  strokeOpacity="0.4"
                  strokeWidth="1.5"
                />
              )}
              <rect
                x={Math.min(Math.max(x - 36, 8), w - 80)}
                y={labelY}
                width={wk.status === "skipped" ? 72 : 64}
                height={15}
                rx={3}
                fill="#18181b"
                fillOpacity="0.95"
                stroke="#3f3f46"
                strokeWidth="1"
              />
              <text
                x={Math.min(Math.max(x - 36, 8), w - 80) + 5}
                y={labelY + 11}
                fill={color}
                fontSize="10"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                {wk.status === "bought"
                  ? "Bought"
                  : wk.status === "skipped"
                    ? "Skipped"
                    : wk.status === "next"
                      ? "Next · Mon"
                      : "Queued"}
              </text>
              <text
                x={x}
                y={h - 4}
                textAnchor="middle"
                fill="#71717a"
                fontSize="9"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                {wk.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-zinc-600">
        {weeks
          .filter((w) => w.detail)
          .map((w) => (
            <span key={w.label}>
              <span className="text-zinc-500">{w.label}:</span> {w.detail}
            </span>
          ))}
      </div>
      {take && (
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">{take}</p>
      )}
    </div>
  );
}
