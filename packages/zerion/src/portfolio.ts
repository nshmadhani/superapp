import {
  cachedPortfolioView,
  portfolioAddressCacheKey,
} from "./api-cache";
import { scheduleZerionCall } from "./rate-limit";
import { fetchVenuePositions } from "./venues";
import {
  buildPortfolioView,
  mergePortfolioViews,
  type PortfolioView,
  type PortfolioWalletRow,
} from "./view";

export type PortfolioPosition = {
  symbol: string;
  name: string;
  quantity: string;
  valueUsd: number | null;
  chainId: string;
  address: string | null;
  /** Zerion fungible icon URL when present. */
  iconUrl?: string | null;
  /** wallet token vs DeFi protocol position (Morpho, Aave, …). */
  kind?: "wallet" | "defi";
  protocol?: string | null;
  positionType?: string | null;
};

export type PortfolioSnapshot = {
  address: string;
  positions: PortfolioPosition[];
  totalValueUsd: number;
  asOf: string;
  chainFamily?: "evm" | "solana";
};

const RETRY_429_DELAYS_MS = [1_500, 3_000, 6_000];

function isZerion429(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status = (err as { status?: number }).status;
  if (status === 429) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /Zerion 429|Too many requests|throttled/i.test(msg);
}

async function fetchPortfolioUncachedWithRetry(
  address: string,
  apiKey: string,
): Promise<PortfolioSnapshot> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_429_DELAYS_MS.length; attempt++) {
    try {
      return await fetchPortfolioUncached(address, apiKey);
    } catch (err) {
      lastErr = err;
      if (!isZerion429(err) || attempt === RETRY_429_DELAYS_MS.length) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, RETRY_429_DELAYS_MS[attempt]!));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("portfolio_failed");
}

/** Same-isolate stampede control only — durable TTL lives in portfolio_cache. */
const inflight = new Map<string, Promise<PortfolioSnapshot>>();

function normalizeAddress(address: string): string {
  return address.startsWith("0x") ? address.toLowerCase() : address;
}

function detectChainFamily(address: string): "evm" | "solana" {
  return /^0x[a-fA-F0-9]{40}$/.test(address) ? "evm" : "solana";
}

export function clearPortfolioCache(): void {
  inflight.clear();
}

async function fetchPortfolioUncached(
  address: string,
  apiKey: string,
): Promise<PortfolioSnapshot> {
  const chainFamily = detectChainFamily(address);
  const url = new URL(
    `https://api.zerion.io/v1/wallets/${encodeURIComponent(address)}/positions/`,
  );
  // EVM: include DeFi (Morpho, lending, LP, …) plus wallet tokens.
  // Solana: Zerion rejects filter[positions]=no_filter — use default positions.
  if (chainFamily === "evm") {
    url.searchParams.set("filter[positions]", "no_filter");
  }
  url.searchParams.set("currency", "usd");
  url.searchParams.set("filter[trash]", "only_non_trash");

  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(
      `Zerion ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const body = (await res.json()) as {
    data: Array<{
      attributes: {
        name?: string;
        protocol?: string | null;
        protocol_module?: string | null;
        position_type?: string | null;
        quantity: { float: number };
        value: number | null;
        fungible_info?: {
          symbol: string;
          name: string;
          icon?: { url?: string | null } | null;
          implementations?: Array<{
            chain_id: string;
            address: string | null;
          }>;
        } | null;
      };
      relationships?: {
        chain?: { data?: { id?: string } };
      };
    }>;
  };

  const positions: PortfolioPosition[] = (body.data ?? []).map((row) => {
    const attrs = row.attributes;
    const impl = attrs.fungible_info?.implementations?.[0];
    const chainId =
      row.relationships?.chain?.data?.id ??
      impl?.chain_id ??
      (chainFamily === "solana" ? "solana" : "unknown");
    const isDefi = Boolean(attrs.protocol) || attrs.position_type === "deposit";
    const symbol =
      attrs.fungible_info?.symbol ??
      (attrs.protocol
        ? String(attrs.protocol).split(/\s+/)[0]!.slice(0, 12)
        : "POS");
    const name = isDefi
      ? [attrs.protocol, attrs.name].filter(Boolean).join(" · ") ||
        attrs.name ||
        symbol
      : (attrs.fungible_info?.name ?? attrs.name ?? symbol);
    return {
      symbol,
      name,
      quantity: String(attrs.quantity.float),
      valueUsd: attrs.value,
      chainId,
      address: impl?.address ?? null,
      iconUrl: attrs.fungible_info?.icon?.url ?? null,
      kind: isDefi ? ("defi" as const) : ("wallet" as const),
      protocol: attrs.protocol ?? null,
      positionType: attrs.position_type ?? null,
    };
  });

  const totalValueUsd = positions.reduce((s, p) => s + (p.valueUsd ?? 0), 0);
  return {
    address,
    positions,
    totalValueUsd,
    asOf: new Date().toISOString(),
    chainFamily,
  };
}

/**
 * Fetch fungible positions for an EVM or Solana address via Zerion.
 * Rate-limited (≤1/sec) and deduped while in flight.
 * Durable TTL caching is at the PortfolioView layer (`cachedPortfolioView`).
 */
export async function fetchPortfolio(
  address: string,
  apiKey = process.env.ZERION_API_KEY,
  opts?: { force?: boolean },
): Promise<PortfolioSnapshot> {
  if (!apiKey) throw new Error("Missing ZERION_API_KEY");

  const key = normalizeAddress(address);
  if (!opts?.force) {
    const pending = inflight.get(key);
    if (pending) return pending;
  }

  const job = scheduleZerionCall(() =>
    fetchPortfolioUncachedWithRetry(address, apiKey),
  ).finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, job);
  return job;
}

/** @deprecated Use PortfolioView — kept as alias for wallet-row typing. */
export type AggregatedPortfolio = PortfolioView;

/**
 * Shape a single-wallet Zerion snapshot into the dashboard/agent PortfolioView.
 */
export async function portfolioSnapshotToView(
  snap: PortfolioSnapshot,
  wallet?: {
    walletId: string;
    label?: string;
    chainFamily: "evm" | "solana";
    source: string;
  },
): Promise<PortfolioView> {
  const walletRows: PortfolioWalletRow[] = wallet
    ? [
        {
          walletId: wallet.walletId,
          address: snap.address,
          label: wallet.label,
          chainFamily: wallet.chainFamily,
          source: wallet.source,
          totalValueUsd: snap.totalValueUsd,
          positions: snap.positions,
        },
      ]
    : [];
  const venuePositions = await fetchVenuePositions(
    wallet
      ? [
          {
            address: snap.address,
            walletId: wallet.walletId,
            walletLabel: wallet.label,
            chainFamily: wallet.chainFamily,
          },
        ]
      : [
          {
            address: snap.address,
            chainFamily: detectChainFamily(snap.address),
          },
        ],
  );
  return buildPortfolioView({
    legs: snap.positions.map((p) => ({
      ...p,
      walletId: wallet?.walletId,
      walletLabel: wallet?.label,
      walletAddress: snap.address,
    })),
    wallets: walletRows,
    asOf: snap.asOf,
    venuePositions,
  });
}

async function loadWalletView(
  wallet: {
    id: string;
    address: string;
    chainFamily: "evm" | "solana";
    source: string;
    label?: string;
  },
  opts?: { force?: boolean },
): Promise<PortfolioView> {
  return cachedPortfolioView(
    portfolioAddressCacheKey(wallet.address),
    async () => {
      const snap = await fetchPortfolio(wallet.address, undefined, opts);
      return portfolioSnapshotToView(snap, {
        walletId: wallet.id,
        label: wallet.label,
        chainFamily: wallet.chainFamily,
        source: wallet.source,
      });
    },
    {
      force: opts?.force,
      address: normalizeAddress(wallet.address),
    },
  );
}

/**
 * Aggregate many wallets into a shaped PortfolioView.
 * Each wallet is loaded via the durable address cache; callers wrap with user:all.
 */
export async function fetchAggregatedPortfolio(
  wallets: Array<{
    id: string;
    address: string;
    chainFamily: "evm" | "solana";
    source: string;
    label?: string;
  }>,
  opts?: { force?: boolean },
): Promise<PortfolioView> {
  const views: PortfolioView[] = [];
  // Sequential await keeps ordering predictable; rate limiter also serializes HTTP.
  for (const w of wallets) {
    try {
      views.push(await loadWalletView(w, opts));
    } catch (err) {
      views.push(
        buildPortfolioView({
          legs: [],
          wallets: [
            {
              walletId: w.id,
              address: w.address,
              label: w.label,
              chainFamily: w.chainFamily,
              source: w.source,
              totalValueUsd: 0,
              positions: [],
              error: err instanceof Error ? err.message : "portfolio_failed",
            },
          ],
          asOf: new Date().toISOString(),
        }),
      );
    }
  }
  return mergePortfolioViews(views);
}
