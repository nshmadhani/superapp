"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CIPHER_AUTHED_EVENT } from "@/components/auth-sync";
import { CIPHER_WALLETS_SYNCED_EVENT } from "@/lib/sync-wallets";
import {
  addressesMatch,
  walletDisplayName,
  walletSelectLabel,
} from "@/lib/wallet-display";
import type {
  PortfolioLeg,
  PortfolioView,
  ProtocolGroup,
  TokenGroup,
} from "@cipher/zerion";
import {
  resolveChainIcon,
  resolveProtocolIcon,
} from "@cipher/zerion";

type Wallet = {
  id: string;
  address: string;
  source: string;
  label?: string;
  chainFamily?: "evm" | "solana";
};

/** Positions below this USD value are hidden when "Hide dust" is on. */
const DUST_USD_MIN = 1;

const OVERVIEW = "__overview__";

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
  arbitrum: "#28A0F0",
  hyperevm: "#97FCE4",
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

function LetterAvatar({
  label,
  color,
  bg,
  size,
}: {
  label: string;
  color: string;
  bg: string;
  size: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color,
        fontSize: Math.max(9, size * 0.38),
        boxShadow: `inset 0 0 0 1px ${color}55`,
      }}
      aria-hidden
    >
      {label}
    </span>
  );
}

function RemoteIcon({
  src,
  size,
  fallback,
}: {
  src: string | null;
  size: number;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  if (!src || failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full bg-zinc-900 object-cover"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}

function TokenIcon({
  symbol,
  iconUrl,
  size = 28,
}: {
  symbol: string;
  iconUrl?: string | null;
  size?: number;
}) {
  const meta = tokenMeta(symbol);
  return (
    <RemoteIcon
      src={iconUrl ?? null}
      size={size}
      fallback={
        <LetterAvatar
          label={meta.label}
          color={meta.color}
          bg={meta.bg}
          size={size}
        />
      }
    />
  );
}

function ChainIcon({
  chainId,
  size = 16,
}: {
  chainId: string;
  size?: number;
}) {
  const color =
    CHAIN_COLORS[chainId.toLowerCase()] ??
    CHAIN_COLORS[chainId] ??
    "#a1a1aa";
  return (
    <RemoteIcon
      src={resolveChainIcon(chainId)}
      size={size}
      fallback={
        <LetterAvatar
          label={chainId.slice(0, 1).toUpperCase()}
          color={color}
          bg={`${color}33`}
          size={size}
        />
      }
    />
  );
}

function ProtocolIcon({
  protocol,
  size = 28,
}: {
  protocol: string;
  size?: number;
}) {
  return (
    <RemoteIcon
      src={resolveProtocolIcon(protocol)}
      size={size}
      fallback={
        <LetterAvatar
          label={protocol.slice(0, 2).toUpperCase()}
          color="#34d399"
          bg="#34d39933"
          size={size}
        />
      }
    />
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

function ChainBadge({ chainId }: { chainId: string }) {
  return (
    <span className="inline-flex shrink-0" title={chainId}>
      <ChainIcon chainId={chainId} size={18} />
    </span>
  );
}

function filterLegs(
  legs: PortfolioLeg[],
  chainFilter: string,
  hideDust: boolean,
): PortfolioLeg[] {
  return legs.filter((l) => {
    if (chainFilter !== "all" && l.chainId !== chainFilter) return false;
    if (hideDust && (l.valueUsd ?? 0) < DUST_USD_MIN) return false;
    return true;
  });
}

function AllocationBars({
  title,
  rows,
  total,
}: {
  title: string;
  rows: Array<{ label: string; value: number; color: string }>;
  total: number;
}) {
  const slices = rows.filter((r) => r.value > 0).slice(0, 8);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-800/80">
        {slices.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <div
              key={s.label}
              title={`${s.label} ${pct.toFixed(1)}%`}
              style={{
                width: `${Math.max(pct, 1.5)}%`,
                backgroundColor: s.color,
              }}
            />
          );
        })}
      </div>
      <ul className="mt-3 space-y-1.5">
        {slices.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <li
              key={s.label}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="flex items-center gap-2 text-zinc-200">
                <span
                  className="inline-block size-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: s.color }}
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

function TokenGroupRow({
  group,
  showWallet,
}: {
  group: TokenGroup;
  showWallet: boolean;
}) {
  const multi = group.legs.length > 1 || group.chainCount > 1;
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-zinc-800/80">
      <button
        type="button"
        onClick={() => multi && setOpen((v) => !v)}
        className={`flex w-full items-center gap-3 py-3 text-left ${
          multi ? "cursor-pointer hover:bg-white/[0.02]" : "cursor-default"
        }`}
        disabled={!multi}
        aria-expanded={multi ? open : undefined}
      >
        <TokenIcon symbol={group.symbol} iconUrl={group.iconUrl} size={28} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-white">{group.symbol}</span>
            {group.chainCount > 1 && (
              <span className="inline-flex items-center gap-1 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                <span className="inline-flex -space-x-1.5">
                  {[...new Set(group.legs.map((l) => l.chainId))]
                    .slice(0, 3)
                    .map((c) => (
                      <ChainIcon key={c} chainId={c} size={16} />
                    ))}
                </span>
                {group.chainCount} chains
              </span>
            )}
            {!multi && group.legs[0] && (
              <ChainBadge chainId={group.legs[0].chainId} />
            )}
          </div>
          <p className="truncate text-xs text-zinc-500">{group.name}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm text-zinc-100">
            {usd(group.valueUsd)}
          </p>
          <p className="font-mono text-[11px] text-zinc-500">
            {group.quantity}
          </p>
        </div>
        {multi && (
          <span className="w-4 shrink-0 text-center text-zinc-500">
            {open ? "▾" : "▸"}
          </span>
        )}
      </button>
      {multi && open && (
        <ul className="mb-2 ml-10 space-y-1.5 border-l border-zinc-800 pl-3">
          {group.legs.map((leg, i) => (
            <li
              key={`${leg.chainId}-${leg.walletAddress ?? ""}-${i}`}
              className="flex flex-wrap items-center justify-between gap-2 py-1 text-xs"
            >
              <span className="inline-flex flex-wrap items-center gap-2 text-zinc-300">
                <ChainBadge chainId={leg.chainId} />
                {showWallet && leg.walletLabel && (
                  <span className="text-zinc-500">
                    {walletDisplayName({ label: leg.walletLabel })}
                  </span>
                )}
                <span className="font-mono text-zinc-500">{leg.quantity}</span>
              </span>
              <span className="font-mono text-zinc-400">
                {usd(leg.valueUsd)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProtocolGroupRow({
  group,
  showWallet,
}: {
  group: ProtocolGroup;
  showWallet: boolean;
}) {
  const multi = group.legs.length > 1;
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-zinc-800/80">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-3 py-3 text-left hover:bg-white/[0.02]"
        aria-expanded={open}
      >
        <ProtocolIcon protocol={group.protocol} size={28} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white">{group.protocol}</p>
          <p className="text-xs text-zinc-500">
            {group.legs.length} position{group.legs.length === 1 ? "" : "s"}
          </p>
        </div>
        <p className="shrink-0 font-mono text-sm text-zinc-100">
          {usd(group.valueUsd)}
        </p>
        <span className="w-4 shrink-0 text-center text-zinc-500">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <ul className="mb-2 ml-10 space-y-1.5 border-l border-zinc-800 pl-3">
          {group.legs.map((leg, i) => (
            <li
              key={`${leg.symbol}-${leg.chainId}-${i}`}
              className="flex flex-wrap items-center justify-between gap-2 py-1 text-xs"
            >
              <span className="inline-flex flex-wrap items-center gap-2 text-zinc-300">
                <TokenIcon
                  symbol={leg.symbol}
                  iconUrl={leg.iconUrl}
                  size={18}
                />
                <span className="text-zinc-200">{leg.symbol}</span>
                <ChainBadge chainId={leg.chainId} />
                {leg.positionType && (
                  <span className="text-zinc-600">{leg.positionType}</span>
                )}
                {showWallet && leg.walletLabel && (
                  <span className="text-zinc-500">
                    {walletDisplayName({ label: leg.walletLabel })}
                  </span>
                )}
              </span>
              <span className="font-mono text-zinc-400">
                {usd(leg.valueUsd)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  total,
  hint,
}: {
  title: string;
  total: number;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 pb-1">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-zinc-100">
          {title}
        </h2>
        {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
      </div>
      <p className="font-mono text-sm text-zinc-300">{usd(total)}</p>
    </div>
  );
}

export function DashboardPortfolio() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selected, setSelected] = useState<string>(OVERVIEW);
  const [view, setView] = useState<PortfolioView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [hideDust, setHideDust] = useState(true);

  const walletsKey = useMemo(
    () =>
      wallets
        .map((w) => `${w.id}:${w.address}`)
        .sort()
        .join("|"),
    [wallets],
  );

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

  const loadPortfolio = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url =
        selected === OVERVIEW
          ? "/api/portfolio?scope=all"
          : `/api/portfolio?address=${encodeURIComponent(selected)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load portfolio");
      setView(data as PortfolioView);
    } catch (err) {
      setView(null);
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    void loadWallets();
    const onAuthed = () => void loadWallets();
    const onSynced = () => {
      void (async () => {
        await loadWallets();
        await loadPortfolio();
      })();
    };
    window.addEventListener(CIPHER_AUTHED_EVENT, onAuthed);
    window.addEventListener(CIPHER_WALLETS_SYNCED_EVENT, onSynced);
    return () => {
      window.removeEventListener(CIPHER_AUTHED_EVENT, onAuthed);
      window.removeEventListener(CIPHER_WALLETS_SYNCED_EVENT, onSynced);
    };
  }, [loadWallets, loadPortfolio]);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio, walletsKey]);

  const activeWallet = wallets.find((w) => addressesMatch(w.address, selected));
  const title =
    selected === OVERVIEW
      ? "Overview"
      : activeWallet
        ? walletDisplayName(activeWallet)
        : "Portfolio";

  const total = view?.totalValueUsd ?? 0;
  const showWallet = selected === OVERVIEW;

  const filteredTokens = useMemo(() => {
    if (!view) return [];
    return view.tokens
      .map((g) => {
        const legs = filterLegs(g.legs, chainFilter, hideDust);
        if (legs.length === 0) return null;
        const valueUsd = legs.reduce((s, l) => s + (l.valueUsd ?? 0), 0);
        const qtySum = legs.reduce(
          (s, l) => s + (Number.parseFloat(l.quantity) || 0),
          0,
        );
        const chains = new Set(legs.map((l) => l.chainId));
        return {
          ...g,
          legs,
          valueUsd,
          quantity: String(Number(qtySum.toPrecision(6))),
          chainCount: chains.size,
        } satisfies TokenGroup;
      })
      .filter((g): g is TokenGroup => g != null)
      .sort((a, b) => b.valueUsd - a.valueUsd);
  }, [view, chainFilter, hideDust]);

  const filteredDefi = useMemo(() => {
    if (!view) return [];
    return view.defi
      .map((g) => {
        const legs = filterLegs(g.legs, chainFilter, hideDust);
        if (legs.length === 0) return null;
        return {
          ...g,
          legs,
          valueUsd: legs.reduce((s, l) => s + (l.valueUsd ?? 0), 0),
        } satisfies ProtocolGroup;
      })
      .filter((g): g is ProtocolGroup => g != null)
      .sort((a, b) => b.valueUsd - a.valueUsd);
  }, [view, chainFilter, hideDust]);

  const tokensTotal = filteredTokens.reduce((s, t) => s + t.valueUsd, 0);
  const defiTotal = filteredDefi.reduce((s, d) => s + d.valueUsd, 0);

  const chains = useMemo(() => {
    if (!view) return [];
    const ids = new Set<string>();
    for (const t of view.tokens) for (const l of t.legs) ids.add(l.chainId);
    for (const d of view.defi) for (const l of d.legs) ids.add(l.chainId);
    return [...ids].sort();
  }, [view]);

  const sleeveRows = useMemo(
    () =>
      [
        { label: "Tokens", value: tokensTotal, color: "#38bdf8" },
        { label: "DeFi", value: defiTotal, color: "#34d399" },
        {
          label: "Positions",
          value: view?.positionsValueUsd ?? 0,
          color: "#a78bfa",
        },
      ].filter((r) => r.value > 0 || r.label === "Tokens"),
    [tokensTotal, defiTotal, view?.positionsValueUsd],
  );

  const assetRows = useMemo(
    () =>
      filteredTokens.slice(0, 8).map((t) => ({
        label: t.symbol,
        value: t.valueUsd,
        color: tokenMeta(t.symbol).color,
      })),
    [filteredTokens],
  );

  const overviewCards = useMemo(() => {
    if (selected !== OVERVIEW) return [];
    const byAddr = new Map<
      string,
      {
        walletId: string;
        address: string;
        label?: string;
        chainFamily: "evm" | "solana";
        source: string;
        totalValueUsd: number;
        error?: string;
      }
    >();
    for (const w of wallets) {
      const key = w.address.startsWith("0x")
        ? w.address.toLowerCase()
        : w.address;
      byAddr.set(key, {
        walletId: w.id,
        address: w.address,
        label: w.label,
        chainFamily: w.chainFamily === "solana" ? "solana" : "evm",
        source: w.source,
        totalValueUsd: 0,
      });
    }
    for (const w of view?.wallets ?? []) {
      const key = w.address.startsWith("0x")
        ? w.address.toLowerCase()
        : w.address;
      byAddr.set(key, {
        walletId: w.walletId,
        address: w.address,
        label: w.label,
        chainFamily: w.chainFamily,
        source: w.source,
        totalValueUsd: w.totalValueUsd,
        error: w.error,
      });
    }
    return [...byAddr.values()];
  }, [selected, wallets, view?.wallets]);

  return (
    <div className="cipher-scroll h-full overflow-y-auto">
      <div className="flex w-full flex-col gap-5 px-6 py-8 lg:px-10">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Dashboard
          </h1>
          <p className="text-sm text-zinc-500">
            Tokens, venue positions, and DeFi — by wallet.
          </p>
        </header>

        {loading && <p className="text-sm text-zinc-500">Loading…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !error && (
          <>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {title}
              </p>
              <p className="mt-1 text-3xl font-semibold text-white">
                {usd(total)}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
                <span>
                  Tokens{" "}
                  <span className="font-mono text-zinc-300">
                    {usd(tokensTotal)}
                  </span>
                </span>
                <span className="text-zinc-700">·</span>
                <span>
                  DeFi{" "}
                  <span className="font-mono text-zinc-300">
                    {usd(defiTotal)}
                  </span>
                </span>
                <span className="text-zinc-700">·</span>
                <span>
                  Positions{" "}
                  <span className="font-mono text-zinc-300">
                    {usd(view?.positionsValueUsd ?? 0)}
                  </span>
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <AllocationBars
                title="By sleeve"
                total={Math.max(tokensTotal + defiTotal, 1)}
                rows={sleeveRows}
              />
              <AllocationBars
                title="Top tokens"
                total={Math.max(tokensTotal, 1)}
                rows={assetRows}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <span>Wallet</span>
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-white"
                >
                  <option value={OVERVIEW}>Overview · all wallets</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.address}>
                      {walletSelectLabel(w, wallets)} ·{" "}
                      {w.chainFamily === "solana" ? "SOL" : "EVM"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-zinc-400">
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
              <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={hideDust}
                  onChange={(e) => setHideDust(e.target.checked)}
                  className="rounded border-zinc-700"
                />
                {`Hide dust (<$${DUST_USD_MIN})`}
              </label>
            </div>

            {selected === OVERVIEW && overviewCards.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {overviewCards.map((w) => (
                  <button
                    key={w.walletId}
                    type="button"
                    onClick={() => setSelected(w.address)}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-3 text-left transition-colors hover:border-zinc-600"
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
                    {w.error ? (
                      <p className="mt-1 text-[10px] text-amber-400/90">
                        {/429|throttl/i.test(w.error)
                          ? "Balance refresh rate-limited — retry shortly"
                          : "Balance fetch failed"}
                      </p>
                    ) : (
                      <p className="mt-1 font-mono text-[10px] text-zinc-600">
                        {shortAddr(w.address)}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
              <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 xl:col-span-1">
                <SectionHeader
                  title="Tokens"
                  total={tokensTotal}
                  hint="Grouped by symbol across chains"
                />
                {filteredTokens.length === 0 ? (
                  <p className="border-t border-zinc-800/80 py-6 text-sm text-zinc-500">
                    No token balances.
                  </p>
                ) : (
                  filteredTokens.map((g) => (
                    <TokenGroupRow
                      key={g.symbol.toUpperCase()}
                      group={g}
                      showWallet={showWallet}
                    />
                  ))
                )}
              </section>

              <div className="flex flex-col gap-5">
                <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
                  <SectionHeader
                    title="Positions"
                    total={view?.positionsValueUsd ?? 0}
                    hint="Hyperliquid & Polymarket"
                  />
                  <ul className="border-t border-zinc-800/80">
                    {(
                      view?.positions.venues ?? [
                        {
                          id: "hyperliquid" as const,
                          status: "coming_soon" as const,
                        },
                        {
                          id: "polymarket" as const,
                          status: "coming_soon" as const,
                        },
                      ]
                    ).map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-3 py-3 text-sm"
                      >
                        <span className="inline-flex items-center gap-2 capitalize text-zinc-200">
                          <ProtocolIcon protocol={v.id} size={22} />
                          {v.id === "hyperliquid"
                            ? "Hyperliquid"
                            : "Polymarket"}
                        </span>
                        <span className="rounded bg-zinc-800/80 px-2 py-0.5 text-[11px] uppercase tracking-wide text-zinc-500">
                          Coming soon
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
                  <SectionHeader
                    title="DeFi"
                    total={defiTotal}
                    hint="Protocol deposits and positions"
                  />
                  {filteredDefi.length === 0 ? (
                    <p className="border-t border-zinc-800/80 py-6 text-sm text-zinc-500">
                      No DeFi positions.
                    </p>
                  ) : (
                    filteredDefi.map((g) => (
                      <ProtocolGroupRow
                        key={g.protocol}
                        group={g}
                        showWallet={showWallet}
                      />
                    ))
                  )}
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
