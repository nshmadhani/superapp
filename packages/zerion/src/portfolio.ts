import { scheduleZerionCall } from "./rate-limit";

export type PortfolioPosition = {
  symbol: string;
  name: string;
  quantity: string;
  valueUsd: number | null;
  chainId: string;
  address: string | null;
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

/** In-process TTL so dashboard + chat don't re-hit Zerion for the same wallet. */
const CACHE_TTL_MS = 60_000;
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

type CacheEntry = {
  expiresAt: number;
  snap: PortfolioSnapshot;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<PortfolioSnapshot>>();

function normalizeAddress(address: string): string {
  return address.startsWith("0x") ? address.toLowerCase() : address;
}

function detectChainFamily(address: string): "evm" | "solana" {
  return /^0x[a-fA-F0-9]{40}$/.test(address) ? "evm" : "solana";
}

export function clearPortfolioCache(): void {
  cache.clear();
  inflight.clear();
}

async function fetchPortfolioUncached(
  address: string,
  apiKey: string,
): Promise<PortfolioSnapshot> {
  const url = new URL(
    `https://api.zerion.io/v1/wallets/${encodeURIComponent(address)}/positions/`,
  );
  // Include DeFi (Morpho vaults, lending, LP, …) plus wallet tokens.
  url.searchParams.set("filter[positions]", "no_filter");
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

  const chainFamily = detectChainFamily(address);

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
      kind: isDefi ? "defi" : "wallet",
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
 * Rate-limited (≤1/sec), TTL-cached, and deduped while in flight.
 */
export async function fetchPortfolio(
  address: string,
  apiKey = process.env.ZERION_API_KEY,
): Promise<PortfolioSnapshot> {
  if (!apiKey) throw new Error("Missing ZERION_API_KEY");

  const key = normalizeAddress(address);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.snap;
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const job = scheduleZerionCall(() =>
    fetchPortfolioUncachedWithRetry(address, apiKey),
  )
    .then((snap) => {
      cache.set(key, { snap, expiresAt: Date.now() + CACHE_TTL_MS });
      return snap;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, job);
  return job;
}

export type AggregatedPortfolio = {
  totalValueUsd: number;
  asOf: string;
  wallets: Array<{
    walletId: string;
    address: string;
    label?: string;
    chainFamily: "evm" | "solana";
    source: string;
    totalValueUsd: number;
    positions: PortfolioPosition[];
    error?: string;
  }>;
  positions: Array<
    PortfolioPosition & {
      walletId: string;
      walletLabel?: string;
      walletAddress: string;
    }
  >;
};

/**
 * Aggregate many wallets. Upstream calls still go through the shared
 * 1/sec queue — do not fan out raw HTTP in parallel.
 */
export async function fetchAggregatedPortfolio(
  wallets: Array<{
    id: string;
    address: string;
    chainFamily: "evm" | "solana";
    source: string;
    label?: string;
  }>,
): Promise<AggregatedPortfolio> {
  const results: Array<{
    wallet: (typeof wallets)[number];
    snap: PortfolioSnapshot | null;
    error?: string;
  }> = [];

  // Sequential await keeps ordering predictable; rate limiter also serializes HTTP.
  for (const w of wallets) {
    try {
      const snap = await fetchPortfolio(w.address);
      results.push({ wallet: w, snap });
    } catch (err) {
      results.push({
        wallet: w,
        snap: null,
        error: err instanceof Error ? err.message : "portfolio_failed",
      });
    }
  }

  const positions: AggregatedPortfolio["positions"] = [];
  const walletRows: AggregatedPortfolio["wallets"] = [];

  for (const r of results) {
    const total = r.snap?.totalValueUsd ?? 0;
    walletRows.push({
      walletId: r.wallet.id,
      address: r.wallet.address,
      label: r.wallet.label,
      chainFamily: r.wallet.chainFamily,
      source: r.wallet.source,
      totalValueUsd: total,
      positions: r.snap?.positions ?? [],
      error: r.error,
    });
    for (const p of r.snap?.positions ?? []) {
      positions.push({
        ...p,
        walletId: r.wallet.id,
        walletLabel: r.wallet.label,
        walletAddress: r.wallet.address,
      });
    }
  }

  positions.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));

  return {
    totalValueUsd: walletRows.reduce((s, w) => s + w.totalValueUsd, 0),
    asOf: new Date().toISOString(),
    wallets: walletRows,
    positions,
  };
}
