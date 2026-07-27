"use client";

import { useMemo, useState } from "react";
import { DEMO_WALLETS, demoPortfolioOverview } from "@/lib/demo/fixtures";
import { walletDisplayName } from "@/lib/wallet-display";

const OVERVIEW = "__overview__";

type Depth = "glance" | "portfolio" | "pro";

const DEPTHS: Array<{ id: Depth; label: string; hint: string }> = [
  { id: "glance", label: "Glance", hint: "One number, top holdings, plain take" },
  {
    id: "portfolio",
    label: "Portfolio",
    hint: "Wallets, allocation, holdings table",
  },
  {
    id: "pro",
    label: "Pro",
    hint: "Charts, KPIs, filters, full position tree",
  },
];

const CHART_COLORS = [
  "#a1a1aa",
  "#71717a",
  "#d4d4d8",
  "#52525b",
  "#e4e4e7",
  "#3f3f46",
  "#fafafa",
  "#27272a",
];

const STABLE_SYMBOLS = new Set(["USDC", "USDT", "DAI", "aUSDC"]);

function usd(n: number | null | undefined) {
  if (n == null) return "n/a";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function shortAddr(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function healthLine(
  byAsset: Array<{ symbol: string; value: number; name: string }>,
  total: number,
): string {
  if (total <= 0 || byAsset.length === 0) return "No positions loaded.";
  const top = byAsset[0]!;
  const topPct = (top.value / total) * 100;
  const stables = byAsset.filter((a) => STABLE_SYMBOLS.has(a.symbol));
  const stablePct =
    (stables.reduce((s, a) => s + a.value, 0) / total) * 100;

  if (stablePct >= 35) {
    return `Mostly cash-like: about ${stablePct.toFixed(0)}% in stables, with ${top.symbol} as the largest risk sleeve.`;
  }
  if (topPct >= 40) {
    return `Concentrated in ${top.symbol} (~${topPct.toFixed(0)}% of net worth). The rest is spread thinner.`;
  }
  return `Balanced across ${byAsset.length} assets. Largest sleeve is ${top.symbol} at ~${topPct.toFixed(0)}%.`;
}

/** Deterministic illustrative equity path scaled to current net worth. */
function seedEquitySeries(total: number, points = 30): number[] {
  const out: number[] = [];
  let v = total * 0.86;
  for (let i = 0; i < points; i++) {
    const wobble =
      Math.sin(i * 0.55) * 0.012 + Math.cos(i * 0.21) * 0.008 + i * 0.0042;
    v = total * (0.86 + wobble);
    out.push(Math.max(v, total * 0.75));
  }
  out[out.length - 1] = total;
  return out;
}

function AllocationBars({
  title,
  rows,
  total,
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
  total: number;
}) {
  const slices = rows.filter((r) => r.value > 0).slice(0, 8);
  return (
    <div className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-zinc-800">
        {slices.map((s, i) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <div
              key={s.label}
              title={`${s.label} ${pct.toFixed(1)}%`}
              style={{
                width: `${Math.max(pct, 1.5)}%`,
                backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
              }}
            />
          );
        })}
      </div>
      <ul className="mt-3 space-y-1.5">
        {slices.map((s, i) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <li
              key={s.label}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="flex items-center gap-2 text-zinc-300">
                <span
                  className="inline-block size-2 shrink-0 rounded-sm"
                  style={{
                    backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                  }}
                />
                {s.label}
              </span>
              <span className="font-mono text-zinc-500">
                {pct.toFixed(0)}% · {usd(s.value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EquitySparkline({ series }: { series: number[] }) {
  if (series.length < 2) return null;
  const w = 280;
  const h = 48;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const pts = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  const first = series[0]!;
  const last = series[series.length - 1]!;
  const deltaPct = ((last - first) / first) * 100;
  const up = deltaPct >= 0;

  return (
    <div className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Equity · 30d (illustrative)
        </p>
        <p
          className={`font-mono text-xs ${up ? "text-emerald-400" : "text-red-400"}`}
        >
          {up ? "+" : ""}
          {deltaPct.toFixed(1)}%
        </p>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="mt-2 h-12 w-full"
        role="img"
        aria-label="Illustrative equity sparkline"
      >
        <polyline
          points={pts}
          fill="none"
          stroke={up ? "#34d399" : "#f87171"}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <p className="mt-1 text-[10px] text-zinc-600">
        Seeded path for the demo, scaled to current net worth. Not live PnL.
      </p>
    </div>
  );
}

export function DemoDashboard() {
  const overview = useMemo(() => demoPortfolioOverview(), []);
  const [selected, setSelected] = useState<string>(OVERVIEW);
  const [depth, setDepth] = useState<Depth>("glance");
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [hideDust, setHideDust] = useState(true);

  const activeWallet = DEMO_WALLETS.find((w) => w.address === selected);
  const title =
    selected === OVERVIEW
      ? "Overview"
      : activeWallet
        ? walletDisplayName(activeWallet)
        : "Portfolio";

  const rawPositions =
    selected === OVERVIEW
      ? overview.positions
      : (activeWallet?.positions ?? []);

  const total =
    selected === OVERVIEW
      ? overview.totalValueUsd
      : (activeWallet?.totalValueUsd ?? 0);

  const byChain = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of overview.positions) {
      map.set(p.chainId, (map.get(p.chainId) ?? 0) + p.valueUsd);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [overview.positions]);

  const byAsset = useMemo(() => {
    const map = new Map<
      string,
      { name: string; value: number; wallets: number }
    >();
    for (const p of overview.positions) {
      const cur = map.get(p.symbol) ?? {
        name: p.name,
        value: 0,
        wallets: 0,
      };
      cur.value += p.valueUsd;
      cur.wallets += 1;
      map.set(p.symbol, cur);
    }
    return [...map.entries()]
      .map(([symbol, row]) => ({ symbol, ...row }))
      .sort((a, b) => b.value - a.value);
  }, [overview.positions]);

  const positions = useMemo(() => {
    let rows = rawPositions;
    if (chainFilter !== "all") {
      rows = rows.filter((p) => p.chainId === chainFilter);
    }
    if (hideDust) {
      rows = rows.filter((p) => p.valueUsd >= 50);
    }
    return rows;
  }, [rawPositions, chainFilter, hideDust]);

  const topHoldings = byAsset.slice(0, 5);
  const vibe = healthLine(byAsset, overview.totalValueUsd);
  const chains = useMemo(
    () => [...new Set(overview.positions.map((p) => p.chainId))].sort(),
    [overview.positions],
  );

  const proScopeTotal =
    selected === OVERVIEW ? overview.totalValueUsd : total;
  const proAssets = useMemo(() => {
    if (selected === OVERVIEW) {
      return byAsset.map((a) => ({ label: a.symbol, value: a.value }));
    }
    const map = new Map<string, number>();
    for (const p of rawPositions) {
      map.set(p.symbol, (map.get(p.symbol) ?? 0) + p.valueUsd);
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [selected, byAsset, rawPositions]);

  const proChains = useMemo(() => {
    if (selected === OVERVIEW) {
      return byChain.map(([label, value]) => ({ label, value }));
    }
    const map = new Map<string, number>();
    for (const p of rawPositions) {
      map.set(p.chainId, (map.get(p.chainId) ?? 0) + p.valueUsd);
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [selected, byChain, rawPositions]);

  const topAssetPct =
    proScopeTotal > 0 && proAssets[0]
      ? (proAssets[0].value / proScopeTotal) * 100
      : 0;
  const stablePct =
    proScopeTotal > 0
      ? (rawPositions
          .filter((p) => STABLE_SYMBOLS.has(p.symbol))
          .reduce((s, p) => s + p.valueUsd, 0) /
          proScopeTotal) *
        100
      : 0;
  const equity = useMemo(
    () => seedEquitySeries(overview.totalValueUsd),
    [overview.totalValueUsd],
  );

  return (
    <div className="cipher-scroll h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-8">
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Dashboard
              </h1>
              <p className="text-sm text-zinc-500">
                {DEPTHS.find((d) => d.id === depth)?.hint}
              </p>
            </div>
            <div
              className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5"
              role="tablist"
              aria-label="Dashboard depth"
            >
              {DEPTHS.map((d) => {
                const on = depth === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setDepth(d.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      on
                        ? "bg-zinc-100 text-zinc-900"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {depth === "glance" ? "Net worth · all wallets" : title}
            </p>
            <p className="text-3xl font-semibold text-white">
              {usd(depth === "glance" ? overview.totalValueUsd : total)}
            </p>
            {depth === "glance" && (
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
                {vibe}
              </p>
            )}
          </div>

          {depth === "pro" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <AllocationBars
                  title="Asset allocation"
                  total={proScopeTotal}
                  rows={proAssets}
                />
                <AllocationBars
                  title="Chain allocation"
                  total={proScopeTotal}
                  rows={proChains}
                />
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-2">
                  <div className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                      Concentration
                    </p>
                    <p className="mt-1 font-mono text-lg text-zinc-100">
                      {topAssetPct.toFixed(0)}%
                    </p>
                    <p className="text-[11px] text-zinc-600">
                      Top sleeve
                      {proAssets[0] ? ` · ${proAssets[0].label}` : ""}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                      Stables
                    </p>
                    <p className="mt-1 font-mono text-lg text-zinc-100">
                      {stablePct.toFixed(0)}%
                    </p>
                    <p className="text-[11px] text-zinc-600">Cash-like share</p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                      Wallets
                    </p>
                    <p className="mt-1 font-mono text-lg text-zinc-100">
                      {selected === OVERVIEW ? overview.wallets.length : 1}
                    </p>
                    <p className="text-[11px] text-zinc-600">In this view</p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                      Chains
                    </p>
                    <p className="mt-1 font-mono text-lg text-zinc-100">
                      {proChains.length}
                    </p>
                    <p className="text-[11px] text-zinc-600">Active networks</p>
                  </div>
                </div>
                <EquitySparkline series={equity} />
              </div>
            </>
          )}

          {depth === "glance" && (
            <div className="space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Top holdings
              </p>
              <ul className="space-y-2">
                {topHoldings.map((row) => {
                  const pct =
                    overview.totalValueUsd > 0
                      ? (row.value / overview.totalValueUsd) * 100
                      : 0;
                  return (
                    <li key={row.symbol} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-zinc-100">
                          {row.symbol}
                          <span className="ml-2 text-xs text-zinc-500">
                            {row.name}
                          </span>
                        </span>
                        <span className="font-mono text-xs text-zinc-300">
                          {usd(row.value)}
                          <span className="ml-2 text-zinc-600">
                            {pct.toFixed(0)}%
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-zinc-400"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-zinc-600">
                Dust under $50 is hidden. Switch to Portfolio or Pro for wallet
                drill-down.
              </p>
            </div>
          )}

          {depth !== "glance" && (
            <label className="block text-sm text-zinc-400">
              <span className="mr-2">Wallet</span>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-white"
              >
                <option value={OVERVIEW}>Overview · all wallets</option>
                {DEMO_WALLETS.map((w) => (
                  <option key={w.walletId} value={w.address}>
                    {walletDisplayName(w)} ·{" "}
                    {w.chainFamily === "solana" ? "SOL" : "EVM"}
                  </option>
                ))}
              </select>
            </label>
          )}

          {depth !== "glance" && selected === OVERVIEW && (
            <>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {overview.wallets.map((w) => (
                  <button
                    key={w.walletId}
                    type="button"
                    onClick={() => setSelected(w.address)}
                    className="rounded-lg border border-zinc-800 bg-black/40 px-3 py-3 text-left transition-colors hover:border-zinc-600"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-white">
                        {walletDisplayName(w)}
                      </span>
                      <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                        {w.chainFamily === "solana" ? "SOL" : "EVM"}
                      </span>
                    </div>
                    <p className="mt-1 text-lg font-semibold text-zinc-100">
                      {usd(w.totalValueUsd)}
                    </p>
                    {depth === "pro" && (
                      <p className="mt-1 font-mono text-[10px] text-zinc-600">
                        {shortAddr(w.address)}
                      </p>
                    )}
                  </button>
                ))}
              </div>
              {depth === "portfolio" && (
                <div className="flex flex-wrap gap-2">
                  {byChain.map(([chain, value]) => (
                    <span
                      key={chain}
                      className="rounded-full border border-zinc-800 px-2.5 py-1 text-[11px] text-zinc-400"
                    >
                      {chain}{" "}
                      <span className="text-zinc-200">{usd(value)}</span>
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          {depth === "pro" && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
              <label className="flex items-center gap-1.5">
                <span>Chain</span>
                <select
                  value={chainFilter}
                  onChange={(e) => setChainFilter(e.target.value)}
                  className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-200"
                >
                  <option value="all">All</option>
                  {chains.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={hideDust}
                  onChange={(e) => setHideDust(e.target.checked)}
                  className="rounded border-zinc-700"
                />
                Hide dust (&lt;$50)
              </label>
            </div>
          )}

          {depth !== "glance" && (
            <table className="w-full text-left text-sm">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-2 font-medium">Asset</th>
                  {(selected === OVERVIEW || depth === "pro") && (
                    <th className="font-medium">Wallet</th>
                  )}
                  {depth === "pro" && (
                    <th className="font-medium">Address</th>
                  )}
                  <th className="font-medium">Chain</th>
                  <th className="font-medium">Qty</th>
                  <th className="font-medium">USD</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p, i) => (
                  <tr
                    key={`${p.symbol}-${p.walletAddress}-${i}`}
                    className="border-t border-zinc-800"
                  >
                    <td className="py-2 text-white">
                      {p.symbol}
                      <span className="ml-2 text-zinc-500">{p.name}</span>
                    </td>
                    {(selected === OVERVIEW || depth === "pro") && (
                      <td className="text-zinc-300">
                        {walletDisplayName({ label: p.walletLabel })}
                      </td>
                    )}
                    {depth === "pro" && (
                      <td className="font-mono text-[11px] text-zinc-500">
                        {shortAddr(p.walletAddress)}
                      </td>
                    )}
                    <td className="text-zinc-300">{p.chainId}</td>
                    <td className="font-mono text-zinc-300">{p.quantity}</td>
                    <td className="text-zinc-300">{usd(p.valueUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {depth === "portfolio" && selected === OVERVIEW && (
          <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div>
              <h2 className="text-sm font-medium text-zinc-100">
                Same money, by asset
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Extra view under the main table. Easy scan of where each token
                stacks up.
              </p>
            </div>
            <ul className="space-y-2">
              {byAsset.map((row) => {
                const pct =
                  overview.totalValueUsd > 0
                    ? (row.value / overview.totalValueUsd) * 100
                    : 0;
                return (
                  <li key={row.symbol} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-zinc-100">
                        {row.symbol}
                        <span className="ml-2 text-xs text-zinc-500">
                          {row.name} · {row.wallets} spots
                        </span>
                      </span>
                      <span className="font-mono text-xs text-zinc-300">
                        {usd(row.value)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-zinc-400"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {depth === "pro" && selected === OVERVIEW && (
          <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div>
              <h2 className="text-sm font-medium text-zinc-100">
                Position tree
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Wallet → chain → asset. Same balances, denser layout.
              </p>
            </div>
            <div className="space-y-4">
              {overview.wallets.map((w) => (
                <div key={w.walletId} className="space-y-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-100">
                      {walletDisplayName(w)}
                      <span className="ml-2 font-mono text-[10px] font-normal text-zinc-600">
                        {shortAddr(w.address)}
                      </span>
                    </p>
                    <p className="font-mono text-xs text-zinc-400">
                      {usd(w.totalValueUsd)}
                    </p>
                  </div>
                  <ul className="ml-2 space-y-1 border-l border-zinc-800 pl-3">
                    {w.positions
                      .filter((p) => !hideDust || p.valueUsd >= 50)
                      .filter(
                        (p) =>
                          chainFilter === "all" || p.chainId === chainFilter,
                      )
                      .map((p, i) => (
                        <li
                          key={`${p.symbol}-${i}`}
                          className="flex flex-wrap items-baseline justify-between gap-2 text-xs"
                        >
                          <span className="text-zinc-300">
                            <span className="text-zinc-500">{p.chainId}</span>
                            {" · "}
                            {p.symbol}
                            <span className="ml-1.5 font-mono text-zinc-600">
                              {p.quantity}
                            </span>
                          </span>
                          <span className="font-mono text-zinc-400">
                            {usd(p.valueUsd)}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
