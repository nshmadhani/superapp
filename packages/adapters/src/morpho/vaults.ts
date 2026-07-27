export type MorphoVault = {
  address: `0x${string}`;
  name: string;
  symbol: string;
  chainId: number;
  assetAddress: `0x${string}`;
  assetSymbol: string;
  assetDecimals: number;
  apy: number;
  tvlUsd: number;
};

type GqlVault = {
  address: string;
  name: string;
  symbol: string;
  chain: { id: number; network: string };
  asset: { address: string; symbol: string; decimals: number };
  state: { apy: number | null; netApy: number | null; totalAssetsUsd: number | null };
};

/** Known USDC Morpho vaults used when GraphQL is down. */
export const FALLBACK_MORPHO_USDC_VAULTS: MorphoVault[] = [
  {
    address: "0xeE8F4eC5672F09119b96Ab6fB59C27E1b7e44b61",
    name: "Gauntlet USDC Prime",
    symbol: "gtUSDCp",
    chainId: 8453,
    assetAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    assetSymbol: "USDC",
    assetDecimals: 6,
    apy: 0.045,
    tvlUsd: 400_000_000,
  },
  {
    address: "0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB",
    name: "Steakhouse USDC",
    symbol: "steakUSDC",
    chainId: 1,
    assetAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    assetSymbol: "USDC",
    assetDecimals: 6,
    apy: 0.04,
    tvlUsd: 70_000_000,
  },
];

export async function fetchMorphoUsdcVaults(limit = 10): Promise<MorphoVault[]> {
  try {
    const res = await fetch("https://blue-api.morpho.org/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: `{
          vaults(
            first: ${limit}
            orderBy: TotalAssetsUsd
            orderDirection: Desc
            where: { assetSymbol_in: ["USDC"], listed: true }
          ) {
            items {
              address name symbol
              chain { id network }
              asset { address symbol decimals }
              state { apy netApy totalAssetsUsd }
            }
          }
        }`,
      }),
    });
    if (!res.ok) throw new Error(`morpho_api_${res.status}`);
    const body = (await res.json()) as {
      data?: { vaults?: { items?: GqlVault[] } };
      errors?: unknown;
    };
    const items = body.data?.vaults?.items ?? [];
    if (!items.length) throw new Error("morpho_empty");
    return items.map((v) => ({
      address: v.address as `0x${string}`,
      name: v.name,
      symbol: v.symbol,
      chainId: v.chain.id,
      assetAddress: v.asset.address as `0x${string}`,
      assetSymbol: v.asset.symbol,
      assetDecimals: v.asset.decimals,
      apy: v.state.netApy ?? v.state.apy ?? 0,
      tvlUsd: v.state.totalAssetsUsd ?? 0,
    }));
  } catch {
    return FALLBACK_MORPHO_USDC_VAULTS.slice(0, limit);
  }
}

export async function resolveMorphoVault(opts: {
  chainId: number;
  vaultAddress?: string;
}): Promise<MorphoVault> {
  const vaults = await fetchMorphoUsdcVaults(20);
  if (opts.vaultAddress) {
    const hit = vaults.find(
      (v) =>
        v.address.toLowerCase() === opts.vaultAddress!.toLowerCase() &&
        v.chainId === opts.chainId,
    );
    if (hit) return hit;
    const fb = FALLBACK_MORPHO_USDC_VAULTS.find(
      (v) =>
        v.address.toLowerCase() === opts.vaultAddress!.toLowerCase() &&
        v.chainId === opts.chainId,
    );
    if (fb) return fb;
    throw new Error("morpho_vault_not_found");
  }
  const onChain = vaults.find((v) => v.chainId === opts.chainId);
  if (onChain) return onChain;
  const fb = FALLBACK_MORPHO_USDC_VAULTS.find((v) => v.chainId === opts.chainId);
  if (fb) return fb;
  throw new Error(`no_morpho_usdc_vault_on_chain_${opts.chainId}`);
}
