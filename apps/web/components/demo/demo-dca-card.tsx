"use client";

export type DcaSnapshot = {
  type: "dca_snapshot";
  asset: string;
  sizeUsd: number;
  cadence: string;
  chain: string;
  agentWallet: string;
  status: string;
  guardRails: Array<{ label: string; value: string }>;
  stats: {
    buys: number;
    skips: number;
    spentUsd: number;
    ethAccumulated: number;
  };
  nextBuy: string;
};

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-black/30 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-zinc-600">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-zinc-100">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-zinc-600">{hint}</p>}
    </div>
  );
}

export function DemoDcaCard({ snap }: { snap: DcaSnapshot }) {
  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Agent desk · {snap.asset} DCA
        </p>
        <p className="text-xs capitalize text-zinc-400">{snap.status}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Size" value={`$${snap.sizeUsd}/buy`} hint={snap.cadence} />
        <Metric label="Chain" value={snap.chain} hint="Allowed only" />
        <Metric
          label="Spent"
          value={`$${snap.stats.spentUsd.toFixed(0)}`}
          hint={`${snap.stats.buys} buys · ${snap.stats.skips} skips`}
        />
        <Metric
          label="Accumulated"
          value={`${snap.stats.ethAccumulated.toFixed(3)} ETH`}
          hint={snap.nextBuy}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-zinc-600">
            Guard rails
          </p>
          <ul className="space-y-1 text-xs text-zinc-300">
            {snap.guardRails.map((g) => (
              <li key={g.label} className="flex justify-between gap-2">
                <span className="text-zinc-500">{g.label}</span>
                <span className="text-right">{g.value}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-zinc-600">
            Agent wallet
          </p>
          <p className="font-mono text-xs text-zinc-300">{snap.agentWallet}</p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Dedicated wallet. Buys run from here. Chat to change size, cadence,
            or rails anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
