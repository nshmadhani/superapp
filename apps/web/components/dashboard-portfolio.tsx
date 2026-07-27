"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CIPHER_AUTHED_EVENT } from "@/components/auth-sync";
import {
  addressesMatch,
  walletDisplayName,
  walletSelectLabel,
} from "@/lib/wallet-display";

type Wallet = {
  id: string;
  address: string;
  source: string;
  label?: string;
  chainFamily?: "evm" | "solana";
};

type Position = {
  symbol: string;
  name: string;
  quantity: string;
  valueUsd: number | null;
  chainId: string;
  walletId?: string;
  walletLabel?: string;
  walletAddress?: string;
};

type Overview = {
  totalValueUsd: number;
  asOf: string;
  wallets: Array<{
    walletId: string;
    address: string;
    label?: string;
    chainFamily: "evm" | "solana";
    source: string;
    totalValueUsd: number;
    positions: Position[];
    error?: string;
  }>;
  positions: Position[];
};

type SingleSnap = {
  address: string;
  totalValueUsd: number;
  positions: Position[];
  asOf: string;
  label?: string;
  chainFamily?: string;
};

const OVERVIEW = "__overview__";

type GroupBy = "wallet" | "chain" | "asset";

function usd(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function groupPositions(
  positions: Position[],
  mode: GroupBy,
): Array<{ key: string; label: string; valueUsd: number; count: number }> {
  const map = new Map<string, { label: string; valueUsd: number; count: number }>();
  for (const p of positions) {
    let key: string;
    let label: string;
    if (mode === "chain") {
      key = p.chainId || "unknown";
      label = key;
    } else if (mode === "asset") {
      key = p.symbol || p.name || "unknown";
      label = `${p.symbol}${p.name ? ` · ${p.name}` : ""}`;
    } else {
      key = p.walletAddress || p.walletId || "wallet";
      label = p.walletLabel || key;
    }
    const prev = map.get(key) ?? { label, valueUsd: 0, count: 0 };
    prev.valueUsd += p.valueUsd ?? 0;
    prev.count += 1;
    map.set(key, prev);
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.valueUsd - a.valueUsd);
}

export function DashboardPortfolio() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selected, setSelected] = useState<string>(OVERVIEW);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [snap, setSnap] = useState<SingleSnap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>("wallet");
  const [drillKey, setDrillKey] = useState<string | null>(null);

  const loadWallets = useCallback(async () => {
    const res = await fetch("/api/wallets");
    if (!res.ok) return;
    const data = await res.json();
    const list = (data.wallets ?? []) as Wallet[];
    setWallets(list);
    setSelected((prev) => {
      if (prev === OVERVIEW) return OVERVIEW;
      if (prev && list.some((w) => addressesMatch(w.address, prev))) return prev;
      return OVERVIEW;
    });
  }, []);

  useEffect(() => {
    void loadWallets();
    const onAuthed = () => void loadWallets();
    window.addEventListener(CIPHER_AUTHED_EVENT, onAuthed);
    return () => window.removeEventListener(CIPHER_AUTHED_EVENT, onAuthed);
  }, [loadWallets]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        if (selected === OVERVIEW) {
          const res = await fetch("/api/portfolio?scope=all");
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Failed to load overview");
          setOverview(data as Overview);
          setSnap(null);
        } else {
          const res = await fetch(
            `/api/portfolio?address=${encodeURIComponent(selected)}`,
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Failed to load portfolio");
          setSnap(data as SingleSnap);
          setOverview(null);
        }
      } catch (err) {
        setOverview(null);
        setSnap(null);
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [selected]);

  const selectOptions = useMemo(
    () =>
      wallets.map((w) => ({
        value: w.address,
        label: walletSelectLabel(
          {
            ...w,
            chainFamily: w.chainFamily,
          },
          wallets,
        ),
      })),
    [wallets],
  );

  const activeWallet = wallets.find((w) => addressesMatch(w.address, selected));
  const title =
    selected === OVERVIEW
      ? "Overview"
      : activeWallet
        ? walletDisplayName(activeWallet)
        : "Portfolio";

  const positions =
    selected === OVERVIEW
      ? (overview?.positions ?? [])
      : (snap?.positions ?? []);
  const total =
    selected === OVERVIEW
      ? (overview?.totalValueUsd ?? 0)
      : (snap?.totalValueUsd ?? 0);
  const asOf =
    selected === OVERVIEW ? overview?.asOf : snap?.asOf;

  const groups = useMemo(
    () => groupPositions(positions, groupBy),
    [positions, groupBy],
  );

  const drilled = useMemo(() => {
    if (!drillKey) return positions;
    return positions.filter((p) => {
      if (groupBy === "chain") return (p.chainId || "unknown") === drillKey;
      if (groupBy === "asset")
        return (p.symbol || p.name || "unknown") === drillKey;
      return (p.walletAddress || p.walletId || "wallet") === drillKey;
    });
  }, [positions, drillKey, groupBy]);

  const chainChips = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of overview?.positions ?? []) {
      const key = p.chainId || "unknown";
      map.set(key, (map.get(key) ?? 0) + (p.valueUsd ?? 0));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [overview?.positions]);

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
              Where your money sits — group by wallet, chain, or asset. Includes
              agent wallets.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-zinc-400">
              <span className="mr-2">View</span>
              <select
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setDrillKey(null);
                }}
                className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-white"
              >
                <option value={OVERVIEW}>Overview · all wallets</option>
                {selectOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-zinc-400">
              <span className="mr-2">Group</span>
              <select
                value={groupBy}
                onChange={(e) => {
                  setGroupBy(e.target.value as GroupBy);
                  setDrillKey(null);
                }}
                className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-white"
              >
                <option value="wallet">Wallet</option>
                <option value="chain">Chain</option>
                <option value="asset">Asset</option>
              </select>
            </label>
          </div>
        </div>

        {loading && <p className="text-sm text-zinc-500">Loading…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !error && (
          <>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {title}
              </p>
              <p className="text-3xl font-semibold text-white">{usd(total)}</p>
            </div>

            {selected === OVERVIEW && chainChips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {chainChips.map(([chain, value]) => (
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

            {groups.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Grouped by {groupBy}
                  </p>
                  {drillKey && (
                    <button
                      type="button"
                      onClick={() => setDrillKey(null)}
                      className="text-xs text-sky-400 hover:underline"
                    >
                      Clear drill-down
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {groups.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() =>
                        setDrillKey((prev) => (prev === g.key ? null : g.key))
                      }
                      className={
                        drillKey === g.key
                          ? "rounded-lg border border-sky-700 bg-sky-950/30 px-3 py-3 text-left"
                          : "rounded-lg border border-zinc-800 bg-black/40 px-3 py-3 text-left transition-colors hover:border-zinc-600"
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-white">
                          {g.label}
                        </span>
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-500">
                          {g.count} pos
                        </span>
                      </div>
                      <p className="mt-1 text-lg font-semibold text-zinc-100">
                        {usd(g.valueUsd)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
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
                {drilled.length === 0 ? (
                  <tr>
                    <td
                      colSpan={selected === OVERVIEW ? 5 : 4}
                      className="py-6 text-zinc-500"
                    >
                      No balances found.
                    </td>
                  </tr>
                ) : (
                  drilled.map((p, i) => (
                    <tr
                      key={`${p.symbol}-${p.walletAddress ?? ""}-${i}`}
                      className="border-t border-zinc-800"
                    >
                      <td className="py-2 text-white">
                        {p.symbol}
                        <span className="ml-2 text-zinc-500">{p.name}</span>
                      </td>
                      {selected === OVERVIEW && (
                        <td className="text-zinc-300">
                          {walletDisplayName({
                            label: p.walletLabel,
                            source: undefined,
                          })}
                        </td>
                      )}
                      <td className="text-zinc-300">{p.chainId}</td>
                      <td className="text-zinc-300">{p.quantity}</td>
                      <td className="text-zinc-300">{usd(p.valueUsd)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {asOf && (
              <p className="text-xs text-zinc-600">as of {asOf}</p>
            )}
          </>
        )}
      </div>
    </div>
    </div>
  );
}
