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
  emphasis,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-black/30 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-zinc-600">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm ${emphasis ? "text-zinc-50" : "text-zinc-200"}`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[10px] text-zinc-600">{hint}</p>}
    </div>
  );
}

export function DemoResearchCard({ snap }: { snap: ResearchSnapshot }) {
  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Research desk · {snap.symbol}
        </p>
        <p className="text-xs text-zinc-400">{snap.thesis}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          label="Attention"
          value={`${snap.scores.attention}/10`}
          hint="CT / narrative heat"
          emphasis
        />
        <Metric
          label="Unlock risk"
          value={`${snap.scores.unlockRisk}/10`}
          hint="Float overhang"
        />
        <Metric
          label="Volume"
          value={`${snap.scores.volumeStrength}/10`}
          hint="Venue usage"
        />
        <Metric
          label="Gov signal"
          value={`${snap.scores.governanceSignal}/10`}
          hint="DAO alpha surface"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-zinc-600">
            Street read
          </p>
          <p className="text-xs leading-relaxed text-zinc-300">
            {snap.narrative}
          </p>
          <p className="mt-2 text-xs text-zinc-500">{snap.sentiment}</p>
        </div>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-zinc-600">
            Risk flags
          </p>
          <ul className="space-y-1 text-xs text-zinc-300">
            {snap.risks.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="text-zinc-600">·</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-zinc-800/80 pt-2 text-xs text-zinc-400">
        <span className="text-zinc-500">Vs quiet bluechip · </span>
        {snap.vsQuietBluechip}
      </div>
    </div>
  );
}
