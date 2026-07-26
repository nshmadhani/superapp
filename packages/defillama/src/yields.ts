export type YieldPool = {
  pool: string;
  project: string;
  chain: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
};

type LlamaPool = YieldPool & { apyBase?: number };

export async function fetchUsdcYields(limit = 10): Promise<YieldPool[]> {
  const res = await fetch("https://yields.llama.fi/pools");
  if (!res.ok) throw new Error(`DeFiLlama ${res.status}`);
  const body = (await res.json()) as { data: LlamaPool[] };
  return body.data
    .filter(
      (p) =>
        p.symbol?.toUpperCase().includes("USDC") && (p.tvlUsd ?? 0) > 1_000_000,
    )
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
    .slice(0, limit)
    .map((p) => ({
      pool: p.pool,
      project: p.project,
      chain: p.chain,
      symbol: p.symbol,
      tvlUsd: p.tvlUsd,
      apy: p.apy,
    }));
}
