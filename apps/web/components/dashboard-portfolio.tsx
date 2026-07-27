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

function usd(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function DashboardPortfolio() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selected, setSelected] = useState<string>(OVERVIEW);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [snap, setSnap] = useState<SingleSnap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-8">
      <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-5 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Dashboard
            </h1>
            <p className="text-sm text-neutral-500">
              Balances across your Ervo and connected wallets.
            </p>
          </div>
          <label className="text-sm text-neutral-400">
            <span className="mr-2">View</span>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="rounded-md border border-neutral-800 bg-black px-2 py-1.5 text-white"
            >
              <option value={OVERVIEW}>Overview · all wallets</option>
              {selectOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading && <p className="text-sm text-neutral-500">Loading…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !error && (
          <>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {title}
              </p>
              <p className="text-3xl font-semibold text-white">{usd(total)}</p>
            </div>

            {selected === OVERVIEW && overview && overview.wallets.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {overview.wallets.map((w) => (
                  <button
                    key={w.walletId}
                    type="button"
                    onClick={() => setSelected(w.address)}
                    className="rounded-lg border border-neutral-800 bg-black/40 px-3 py-3 text-left transition-colors hover:border-neutral-600"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-white">
                        {walletDisplayName(w)}
                      </span>
                      <span className="shrink-0 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
                        {w.chainFamily === "solana" ? "SOL" : "EVM"}
                      </span>
                    </div>
                    <p className="mt-1 text-lg font-semibold text-neutral-100">
                      {usd(w.totalValueUsd)}
                    </p>
                    {w.error && (
                      <p className="mt-1 text-xs text-red-400">{w.error}</p>
                    )}
                  </button>
                ))}
              </div>
            )}

            <table className="w-full text-left text-sm">
              <thead className="text-neutral-500">
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
                {positions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={selected === OVERVIEW ? 5 : 4}
                      className="py-6 text-neutral-500"
                    >
                      No balances found.
                    </td>
                  </tr>
                ) : (
                  positions.map((p, i) => (
                    <tr
                      key={`${p.symbol}-${p.walletAddress ?? ""}-${i}`}
                      className="border-t border-neutral-800"
                    >
                      <td className="py-2 text-white">
                        {p.symbol}
                        <span className="ml-2 text-neutral-500">{p.name}</span>
                      </td>
                      {selected === OVERVIEW && (
                        <td className="text-neutral-300">
                          {walletDisplayName({
                            label: p.walletLabel,
                            source: undefined,
                          })}
                        </td>
                      )}
                      <td className="text-neutral-300">{p.chainId}</td>
                      <td className="text-neutral-300">{p.quantity}</td>
                      <td className="text-neutral-300">{usd(p.valueUsd)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {asOf && (
              <p className="text-xs text-neutral-600">as of {asOf}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
