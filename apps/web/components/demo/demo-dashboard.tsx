"use client";

import { useMemo, useState } from "react";
import { DEMO_WALLETS, demoPortfolioOverview } from "@/lib/demo/fixtures";
import { walletDisplayName } from "@/lib/wallet-display";

const OVERVIEW = "__overview__";

function usd(n: number | null | undefined) {
  if (n == null) return "—";
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

  // Group overview by chain for a simple drill-down feel
  const byChain = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of overview.positions) {
      map.set(p.chainId, (map.get(p.chainId) ?? 0) + p.valueUsd);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [overview.positions]);

  return (
    <div className="cipher-scroll h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-8">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Dashboard
              </h1>
              <p className="text-sm text-zinc-500">
                Where your money sits — grouped by wallet, drill into any one.
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
      </div>
    </div>
  );
}
