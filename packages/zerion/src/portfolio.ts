export type PortfolioPosition = {
  symbol: string;
  name: string;
  quantity: string;
  valueUsd: number | null;
  chainId: string;
  address: string | null;
};

export type PortfolioSnapshot = {
  address: string;
  positions: PortfolioPosition[];
  totalValueUsd: number;
  asOf: string;
  chainFamily?: "evm" | "solana";
};

function detectChainFamily(address: string): "evm" | "solana" {
  return /^0x[a-fA-F0-9]{40}$/.test(address) ? "evm" : "solana";
}

/**
 * Fetch fungible positions for an EVM or Solana address via Zerion.
 * Same endpoint/schema for both chains.
 */
export async function fetchPortfolio(
  address: string,
  apiKey = process.env.ZERION_API_KEY,
): Promise<PortfolioSnapshot> {
  if (!apiKey) throw new Error("Missing ZERION_API_KEY");

  const url = new URL(
    `https://api.zerion.io/v1/wallets/${encodeURIComponent(address)}/positions/`,
  );
  url.searchParams.set("filter[positions]", "only_simple");
  url.searchParams.set("currency", "usd");

  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Zerion ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }

  const body = (await res.json()) as {
    data: Array<{
      attributes: {
        quantity: { float: number };
        value: number | null;
        fungible_info: {
          symbol: string;
          name: string;
          implementations?: Array<{
            chain_id: string;
            address: string | null;
          }>;
        };
      };
      relationships?: {
        chain?: { data?: { id?: string } };
      };
    }>;
  };

  const chainFamily = detectChainFamily(address);

  const positions: PortfolioPosition[] = (body.data ?? []).map((row) => {
    const impl = row.attributes.fungible_info.implementations?.[0];
    const chainId =
      row.relationships?.chain?.data?.id ??
      impl?.chain_id ??
      (chainFamily === "solana" ? "solana" : "unknown");
    return {
      symbol: row.attributes.fungible_info.symbol,
      name: row.attributes.fungible_info.name,
      quantity: String(row.attributes.quantity.float),
      valueUsd: row.attributes.value,
      chainId,
      address: impl?.address ?? null,
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

export async function fetchAggregatedPortfolio(
  wallets: Array<{
    id: string;
    address: string;
    chainFamily: "evm" | "solana";
    source: string;
    label?: string;
  }>,
): Promise<AggregatedPortfolio> {
  const results = await Promise.all(
    wallets.map(async (w) => {
      try {
        const snap = await fetchPortfolio(w.address);
        return { wallet: w, snap, error: undefined as string | undefined };
      } catch (err) {
        return {
          wallet: w,
          snap: null,
          error: err instanceof Error ? err.message : "portfolio_failed",
        };
      }
    }),
  );

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
