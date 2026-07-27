"use client";

import { useMemo, useState } from "react";
import { DEMO_WALLETS, demoPortfolioOverview } from "@/lib/demo/fixtures";
import { walletDisplayName } from "@/lib/wallet-display";

const OVERVIEW = "__overview__";

const STABLE_SYMBOLS = new Set(["USDC", "USDT", "DAI", "aUSDC"]);

const TOKEN_META: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  ETH: { color: "#627EEA", bg: "#627EEA33", label: "ETH" },
  SOL: { color: "#14F195", bg: "#9945FF33", label: "SOL" },
  USDC: { color: "#2775CA", bg: "#2775CA33", label: "$" },
  aUSDC: { color: "#B6509E", bg: "#B6509E33", label: "a$" },
  cbBTC: { color: "#F7931A", bg: "#F7931A33", label: "₿" },
  JUP: { color: "#C7F284", bg: "#C7F28433", label: "J" },
};

const CHAIN_COLORS: Record<string, string> = {
  ethereum: "#627EEA",
  base: "#0052FF",
  solana: "#14F195",
};

function tokenMeta(symbol: string) {
  return (
    TOKEN_META[symbol] ?? {
      color: "#a1a1aa",
      bg: "#27272a",
      label: symbol.slice(0, 1),
    }
  );
}

function TokenIcon({
  symbol,
  size = 22,
}: {
  symbol: string;
  size?: number;
}) {
  const meta = tokenMeta(symbol);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        backgroundColor: meta.bg,
        color: meta.color,
        fontSize: Math.max(9, size * 0.38),
        boxShadow: `inset 0 0 0 1px ${meta.color}55, 0 0 18px ${meta.color}22`,
      }}
      aria-hidden
    >
      {meta.label}
    </span>
  );
}

function usd(n: number | null | undefined) {
  if (n == null) return "n/a";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function shortAddr(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function seedEquitySeries(total: number, points = 30): number[] {
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const wobble =
      Math.sin(i * 0.55) * 0.012 + Math.cos(i * 0.21) * 0.008 + i * 0.0042;
    out.push(Math.max(total * (0.86 + wobble), total * 0.75));
  }
  out[out.length - 1] = total;
  return out;
}

function AllocationBars({
  title,
  rows,
  total,
  kind,
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
  total: number;
  kind: "asset" | "chain";
}) {
  const slices = rows.filter((r) => r.value > 0).slice(0, 8);
  return (
    <div className="rounded-lg border border-zinc-800 bg-gradient-to-br from-zinc-950 to-zinc-900 px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-zinc-800/80">
        {slices.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          const color =
            kind === "asset"
              ? tokenMeta(s.label).color
              : (CHAIN_COLORS[s.label] ?? "#71717a");
          return (
            <div
              key={s.label}
              title={`${s.label} ${pct.toFixed(1)}%`}
              style={{
                width: `${Math.max(pct, 1.5)}%`,
                backgroundColor: color,
              }}
            />
          );
        })}
      </div>
      <ul className="mt-3 space-y-1.5">
        {slices.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          const color =
            kind === "asset"
              ? tokenMeta(s.label).color
              : (CHAIN_COLORS[s.label] ?? "#71717a");
          return (
            <li
              key={s.label}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="flex items-center gap-2 text-zinc-200">
                {kind === "asset" ? (
                  <TokenIcon symbol={s.label} size={18} />
                ) : (
                  <span
                    className="inline-block size-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                )}
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
    <div className="rounded-lg border border-emerald-500/15 bg-gradient-to-br from-emerald-500/5 to-zinc-950 px-3 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Equity · 30d
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
        aria-label="Equity sparkline"
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
    </div>
  );
}

export function DemoDashboard() {
  const overview = useMemo(() => demoPortfolioOverview(), []);
  const [selected, setSelected] = useState<string>(OVERVIEW);
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

  const chains = useMemo(
    () => [...new Set(overview.positions.map((p) => p.chainId))].sort(),
    [overview.positions],
  );

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
    total > 0 && proAssets[0] ? (proAssets[0].value / total) * 100 : 0;
  const stablePct =
    total > 0
      ? (rawPositions
          .filter((p) => STABLE_SYMBOLS.has(p.symbol))
          .reduce((s, p) => s + p.valueUsd, 0) /
          total) *
        100
      : 0;
  const equity = useMemo(
    () => seedEquitySeries(overview.totalValueUsd),
    [overview.totalValueUsd],
  );

  return (
    <div className="cipher-scroll h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-8">
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="flex items-start justify-between gap-3">
            <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Dashboard
            </h1>
            <p className="text-sm text-zinc-500">
              Charts, wallets, filters, and the full position tree.
            </p>
            </div>
            <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-sky-300">
              Pro
            </span>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {title}
            </p>
            <p className="text-3xl font-semibold text-white">{usd(total)}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <AllocationBars
              title="Asset allocation"
              total={total}
              rows={proAssets}
              kind="asset"
            />
            <AllocationBars
              title="Chain allocation"
              total={total}
              rows={proChains}
              kind="chain"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-2">
              <div className="rounded-lg border border-violet-500/15 bg-violet-500/5 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                  Concentration
                </p>
                <p className="mt-1 font-mono text-lg text-zinc-100">
                  {topAssetPct.toFixed(0)}%
                </p>
                <p className="flex items-center gap-1.5 text-[11px] text-zinc-600">
                  Top sleeve
                  {proAssets[0] && (
                    <>
                      <TokenIcon symbol={proAssets[0].label} size={14} />
                      {proAssets[0].label}
                    </>
                  )}
                </p>
              </div>
              <div className="rounded-lg border border-sky-500/15 bg-sky-500/5 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                  Stables
                </p>
                <p className="mt-1 font-mono text-lg text-sky-300">
                  {stablePct.toFixed(0)}%
                </p>
                <p className="text-[11px] text-zinc-600">Cash-like share</p>
              </div>
              <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                  Wallets
                </p>
                <p className="mt-1 font-mono text-lg text-zinc-100">
                  {selected === OVERVIEW ? overview.wallets.length : 1}
                </p>
                <p className="text-[11px] text-zinc-600">In this view</p>
              </div>
              <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-3">
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

          {selected === OVERVIEW && (
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {overview.wallets.map((w) => (
                <button
                  key={w.walletId}
                  type="button"
                  onClick={() => setSelected(w.address)}
                  className="rounded-lg border border-zinc-800 bg-gradient-to-br from-black/60 to-zinc-900/70 px-3 py-3 text-left transition-colors hover:border-zinc-600"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-white">
                      {walletDisplayName(w)}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                        w.chainFamily === "solana"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-indigo-500/15 text-indigo-300"
                      }`}
                    >
                      {w.chainFamily === "solana" ? "SOL" : "EVM"}
                    </span>
                  </div>
                  <p className="mt-1 text-lg font-semibold text-zinc-100">
                    {usd(w.totalValueUsd)}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-zinc-600">
                    {shortAddr(w.address)}
                  </p>
                </button>
              ))}
            </div>
          )}

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

          <table className="w-full text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-2 font-medium">Asset</th>
                <th className="font-medium">Wallet</th>
                <th className="font-medium">Address</th>
                <th className="font-medium">Chain</th>
                <th className="font-medium">Qty</th>
                <th className="font-medium">USD</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => (
                <tr
                  key={`${p.symbol}-${p.walletAddress}-${i}`}
                  className="border-t border-zinc-800 transition-colors hover:bg-white/[0.02]"
                >
                  <td className="py-2 text-white">
                    <span className="inline-flex items-center gap-2">
                      <TokenIcon symbol={p.symbol} size={20} />
                      <span>
                        {p.symbol}
                        <span className="ml-2 text-zinc-500">{p.name}</span>
                      </span>
                    </span>
                  </td>
                  <td className="text-zinc-300">
                    {walletDisplayName({ label: p.walletLabel })}
                  </td>
                  <td className="font-mono text-[11px] text-zinc-500">
                    {shortAddr(p.walletAddress)}
                  </td>
                  <td>
                    <span
                      className="rounded px-1.5 py-0.5 text-[11px]"
                      style={{
                        color: CHAIN_COLORS[p.chainId] ?? "#a1a1aa",
                        backgroundColor: `${CHAIN_COLORS[p.chainId] ?? "#71717a"}22`,
                      }}
                    >
                      {p.chainId}
                    </span>
                  </td>
                  <td className="font-mono text-zinc-300">{p.quantity}</td>
                  <td className="text-zinc-300">{usd(p.valueUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected === OVERVIEW && (
          <div className="space-y-3 rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900/50 to-zinc-950 p-5">
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
                  <ul className="ml-2 space-y-1.5 border-l border-zinc-800 pl-3">
                    {w.positions
                      .filter((p) => !hideDust || p.valueUsd >= 50)
                      .filter(
                        (p) =>
                          chainFilter === "all" || p.chainId === chainFilter,
                      )
                      .map((p, i) => (
                        <li
                          key={`${p.symbol}-${i}`}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <span className="inline-flex items-center gap-2 text-zinc-300">
                            <TokenIcon symbol={p.symbol} size={16} />
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
