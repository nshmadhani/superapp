"use client";

import { useMemo, useState } from "react";
import { DEMO_WALLETS, demoPortfolioOverview } from "@/lib/demo/fixtures";
import { walletDisplayName } from "@/lib/wallet-display";

const OVERVIEW = "__overview__";

function usd(n: number | null | undefined) {
  if (n == null) return "n/a";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function DemoDashboard() {
  const overview = useMemo(() => demoPortfolioOverview(), []);
  const [selected, setSelected] = useState<string>(OVERVIEW);

  const activeWallet = DEMO_WALLETS.find((w) => w.address === selected);
  const title =
    selected === OVERVIEW
      ? "Overview"
      : activeWallet
        ? walletDisplayName(activeWallet)
        : "Portfolio";

  const positions =
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
    const map = new Map<string, { name: string; value: number; wallets: number }>();
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
                Where your money sits. Grouped by wallet. Drill into any one.
              </p>
            </div>
            <label className="text-sm text-zinc-400">
              <span className="mr-2">View</span>
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
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {title}
            </p>
            <p className="text-3xl font-semibold text-white">{usd(total)}</p>
          </div>

          {selected === OVERVIEW && (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
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
                  </button>
                ))}
              </div>
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
            </>
          )}

          <table className="w-full text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-2 font-medium">Asset</th>
                {selected === OVERVIEW && (
                  <th className="font-medium">Wallet</th>
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
                  {selected === OVERVIEW && (
                    <td className="text-zinc-300">
                      {walletDisplayName({ label: p.walletLabel })}
                    </td>
                  )}
                  <td className="text-zinc-300">{p.chainId}</td>
                  <td className="text-zinc-300">{p.quantity}</td>
                  <td className="text-zinc-300">{usd(p.valueUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected === OVERVIEW && (
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
      </div>
    </div>
  );
}
