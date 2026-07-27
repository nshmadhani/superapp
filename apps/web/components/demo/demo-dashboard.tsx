"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DEMO_WALLETS, demoPortfolioOverview } from "@/lib/demo/fixtures";
import { walletDisplayName } from "@/lib/wallet-display";

type GroupMode = "asset" | "wallet" | "chain";
type ThemeId = "cipher" | "eras" | "z";

type Theme = {
  id: ThemeId;
  label: string;
  blurb: string;
  vars: CSSProperties;
};

const THEMES: Theme[] = [
  {
    id: "cipher",
    label: "Cipher",
    blurb: "Default product look",
    vars: {
      ["--dash-bg" as string]: "#09090b",
      ["--dash-panel" as string]: "#111113",
      ["--dash-panel-2" as string]: "#0c0c0e",
      ["--dash-border" as string]: "#27272a",
      ["--dash-text" as string]: "#fafafa",
      ["--dash-muted" as string]: "#71717a",
      ["--dash-accent" as string]: "#e4e4e7",
      ["--dash-accent-soft" as string]: "rgba(228,228,231,0.08)",
      ["--dash-chip" as string]: "#18181b",
    },
  },
  {
    id: "eras",
    label: "Eras",
    blurb: "Taylor Swift–inspired soft night",
    vars: {
      ["--dash-bg" as string]: "#1a0f18",
      ["--dash-panel" as string]: "#24151f",
      ["--dash-panel-2" as string]: "#2b1826",
      ["--dash-border" as string]: "#4a2f42",
      ["--dash-text" as string]: "#fce7f3",
      ["--dash-muted" as string]: "#c4a0b5",
      ["--dash-accent" as string]: "#f9a8d4",
      ["--dash-accent-soft" as string]: "rgba(249,168,212,0.12)",
      ["--dash-chip" as string]: "#3b2133",
    },
  },
  {
    id: "z",
    label: "Z Fighter",
    blurb: "Dragon Ball Z energy",
    vars: {
      ["--dash-bg" as string]: "#0b1020",
      ["--dash-panel" as string]: "#12182c",
      ["--dash-panel-2" as string]: "#171f38",
      ["--dash-border" as string]: "#2e3a66",
      ["--dash-text" as string]: "#f8fafc",
      ["--dash-muted" as string]: "#94a3b8",
      ["--dash-accent" as string]: "#fb923c",
      ["--dash-accent-soft" as string]: "rgba(251,146,60,0.14)",
      ["--dash-chip" as string]: "#1e2744",
    },
  },
];

function usd(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

type Row = {
  key: string;
  title: string;
  subtitle?: string;
  total: number;
  children: Array<{
    key: string;
    label: string;
    meta: string;
    value: number;
  }>;
};

export function DemoDashboard() {
  const overview = useMemo(() => demoPortfolioOverview(), []);
  const [themeId, setThemeId] = useState<ThemeId>("cipher");
  const [group, setGroup] = useState<GroupMode>("asset");
  const [open, setOpen] = useState<Record<string, boolean>>({ ETH: true });

  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]!;

  const rows: Row[] = useMemo(() => {
    if (group === "wallet") {
      return overview.wallets.map((w) => ({
        key: w.walletId,
        title: walletDisplayName(w),
        subtitle: w.chainFamily === "solana" ? "Solana" : "EVM",
        total: w.totalValueUsd,
        children: w.positions.map((p, i) => ({
          key: `${w.walletId}-${p.symbol}-${i}`,
          label: p.symbol,
          meta: `${p.name} · ${p.chainId} · ${p.quantity}`,
          value: p.valueUsd,
        })),
      }));
    }

    if (group === "chain") {
      const map = new Map<string, typeof overview.positions>();
      for (const p of overview.positions) {
        const list = map.get(p.chainId) ?? [];
        list.push(p);
        map.set(p.chainId, list);
      }
      return [...map.entries()]
        .map(([chain, positions]) => ({
          key: chain,
          title: chain,
          subtitle: `${positions.length} positions`,
          total: positions.reduce((s, p) => s + p.valueUsd, 0),
          children: positions.map((p, i) => ({
            key: `${chain}-${p.symbol}-${i}`,
            label: p.symbol,
            meta: `${walletDisplayName({ label: p.walletLabel })} · ${p.quantity}`,
            value: p.valueUsd,
          })),
        }))
        .sort((a, b) => b.total - a.total);
    }

    // asset — “where is my ETH?”
    const map = new Map<string, typeof overview.positions>();
    for (const p of overview.positions) {
      const list = map.get(p.symbol) ?? [];
      list.push(p);
      map.set(p.symbol, list);
    }
    return [...map.entries()]
      .map(([symbol, positions]) => ({
        key: symbol,
        title: symbol,
        subtitle: positions[0]?.name,
        total: positions.reduce((s, p) => s + p.valueUsd, 0),
        children: positions.map((p, i) => ({
          key: `${symbol}-${p.walletId}-${i}`,
          label: walletDisplayName({ label: p.walletLabel }),
          meta: `${p.chainId} · ${p.quantity}`,
          value: p.valueUsd,
        })),
      }))
      .sort((a, b) => b.total - a.total);
  }, [group, overview]);

  function toggle(key: string) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div
      className="cipher-scroll h-full overflow-y-auto"
      style={{
        ...theme.vars,
        background: "var(--dash-bg)",
        color: "var(--dash-text)",
      }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--dash-muted)" }}>
              Smart group-by — ask “where is my money?” then drill down.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p
              className="text-[11px] font-medium uppercase tracking-wide"
              style={{ color: "var(--dash-muted)" }}
            >
              Theme
            </p>
            <div className="flex flex-wrap justify-end gap-1.5">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeId(t.id)}
                  title={t.blurb}
                  className="rounded-full px-3 py-1.5 text-xs transition"
                  style={
                    themeId === t.id
                      ? {
                          background: "var(--dash-accent)",
                          color: "var(--dash-bg)",
                        }
                      : {
                          background: "var(--dash-chip)",
                          color: "var(--dash-text)",
                          border: "1px solid var(--dash-border)",
                        }
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <section
          className="rounded-2xl border p-5"
          style={{
            borderColor: "var(--dash-border)",
            background: "var(--dash-panel)",
          }}
        >
          <p
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: "var(--dash-muted)" }}
          >
            Total · {DEMO_WALLETS.length} wallets
          </p>
          <p className="mt-1 text-4xl font-semibold tracking-tight">
            {usd(overview.totalValueUsd)}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {(
              [
                ["asset", "By asset"],
                ["wallet", "By wallet"],
                ["chain", "By chain"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setGroup(id)}
                className="rounded-lg px-3 py-1.5 text-sm transition"
                style={
                  group === id
                    ? {
                        background: "var(--dash-accent-soft)",
                        color: "var(--dash-accent)",
                        border: "1px solid var(--dash-accent)",
                      }
                    : {
                        background: "var(--dash-chip)",
                        color: "var(--dash-muted)",
                        border: "1px solid var(--dash-border)",
                      }
                }
              >
                {label}
              </button>
            ))}
          </div>

          <p className="mt-3 text-xs" style={{ color: "var(--dash-muted)" }}>
            {group === "asset" &&
              "Expand an asset to see every wallet / chain it lives in."}
            {group === "wallet" &&
              "Each wallet is a world — expand for positions inside."}
            {group === "chain" &&
              "Network lens — expand a chain to see holdings across wallets."}
          </p>
        </section>

        <section className="space-y-2">
          {rows.map((row) => {
            const isOpen = Boolean(open[row.key]);
            return (
              <div
                key={row.key}
                className="overflow-hidden rounded-xl border"
                style={{
                  borderColor: "var(--dash-border)",
                  background: "var(--dash-panel-2)",
                }}
              >
                <button
                  type="button"
                  onClick={() => toggle(row.key)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:opacity-95"
                >
                  {isOpen ? (
                    <ChevronDown
                      className="size-4 shrink-0"
                      style={{ color: "var(--dash-muted)" }}
                    />
                  ) : (
                    <ChevronRight
                      className="size-4 shrink-0"
                      style={{ color: "var(--dash-muted)" }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.title}</p>
                    {row.subtitle && (
                      <p
                        className="truncate text-xs"
                        style={{ color: "var(--dash-muted)" }}
                      >
                        {row.subtitle}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-sm font-semibold">
                    {usd(row.total)}
                  </p>
                </button>
                {isOpen && (
                  <ul
                    className="border-t px-4 py-2"
                    style={{ borderColor: "var(--dash-border)" }}
                  >
                    {row.children.map((c) => (
                      <li
                        key={c.key}
                        className="flex items-baseline justify-between gap-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate">{c.label}</p>
                          <p
                            className="truncate text-xs"
                            style={{ color: "var(--dash-muted)" }}
                          >
                            {c.meta}
                          </p>
                        </div>
                        <p
                          className="shrink-0 font-mono text-xs"
                          style={{ color: "var(--dash-text)" }}
                        >
                          {usd(c.value)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>

        <p className="text-center text-[11px]" style={{ color: "var(--dash-muted)" }}>
          Themes: Cipher · Eras (Taylor) · Z Fighter (DBZ). Layout: smart
          group-by with drill-down.
        </p>
      </div>
    </div>
  );
}
