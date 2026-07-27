"use client";

export type ResearchSnapshot = {
  type: "research_snapshot";
  symbol: string;
  last: number;
  changePct90: number;
  high90: number;
  low90: number;
  narrative: string;
  sentiment: string;
  thesis: string;
  risks: string[];
  vsQuietBluechip: string;
  scores: {
    attention: number;
    unlockRisk: number;
    volumeStrength: number;
    governanceSignal: number;
  };
};

function Metric({
  label,
  value,
  hint,
  tone = "zinc",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "zinc" | "violet" | "rose" | "emerald" | "sky";
}) {
  const toneClass = {
    zinc: "border-zinc-800 bg-black/30",
    violet: "border-violet-500/30 bg-violet-500/10",
    rose: "border-rose-500/30 bg-rose-500/10",
    emerald: "border-emerald-500/30 bg-emerald-500/10",
    sky: "border-sky-500/30 bg-sky-500/10",
  }[tone];
  const valueClass = {
    zinc: "text-zinc-200",
    violet: "text-violet-100",
    rose: "text-rose-100",
    emerald: "text-emerald-100",
    sky: "text-sky-100",
  }[tone];

  return (
    <div className={`rounded-lg border px-2.5 py-2 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className={`mt-0.5 text-sm font-medium ${valueClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-zinc-600">{hint}</p>}
    </div>
  );
}

export function DemoResearchCard({ snap }: { snap: ResearchSnapshot }) {
  const up = snap.changePct90 >= 0;

  return (
    <div className="space-y-3 rounded-xl border border-sky-500/25 bg-gradient-to-br from-sky-500/10 via-zinc-900/80 to-zinc-950 px-3 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-sky-300/80">
          Research desk · {snap.symbol}
        </p>
        <div className="text-right">
          <p className="font-mono text-sm text-zinc-100">
            ${snap.last.toFixed(2)}
            <span
              className={`ml-2 text-xs ${up ? "text-emerald-400" : "text-rose-400"}`}
            >
              {up ? "+" : ""}
              {snap.changePct90.toFixed(1)}%
            </span>
          </p>
          <p className="text-[11px] text-zinc-500">{snap.thesis}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          label="Attention"
          value={`${snap.scores.attention}/10`}
          hint="CT / narrative heat"
          tone="violet"
        />
        <Metric
          label="Unlock risk"
          value={`${snap.scores.unlockRisk}/10`}
          hint="Float overhang"
          tone="rose"
        />
        <Metric
          label="Volume"
          value={`${snap.scores.volumeStrength}/10`}
          hint="Venue usage"
          tone="emerald"
        />
        <Metric
          label="Gov signal"
          value={`${snap.scores.governanceSignal}/10`}
          hint="DAO alpha surface"
          tone="sky"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-2.5 py-2">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-violet-300/80">
            Street read
          </p>
          <p className="text-xs leading-relaxed text-zinc-300">
            {snap.narrative}
          </p>
          <p className="mt-2 text-xs text-violet-200/70">{snap.sentiment}</p>
        </div>
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-2.5 py-2">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-rose-300/80">
            Risk flags
          </p>
          <ul className="space-y-1 text-xs text-zinc-300">
            {snap.risks.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="text-rose-400/80">·</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-zinc-800/80 pt-2 text-xs text-zinc-400">
        <span className="text-sky-400/80">Vs quiet bluechip · </span>
        {snap.vsQuietBluechip}
      </div>
    </div>
  );
}
