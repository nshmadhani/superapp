import { tool } from "ai";
import { z } from "zod";
import { fetchMorphoUsdcVaults } from "@ervo/adapters";
import { fetchUsdcYields } from "@ervo/defillama";

export function getYieldsTool() {
  return tool({
    description:
      "List USDC yield opportunities. Prefer Morpho vaults (executable via create_action_plan lend) — includes vault address + chainId. Also returns DeFiLlama pools for comparison (discovery-only unless Morpho). If the user already holds USDC on that chain with gas, use create_action_plan lend-only (no LI.FI transfer).",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(25).optional(),
      morphoOnly: z
        .boolean()
        .optional()
        .describe("If true, only return executable Morpho USDC vaults"),
    }),
    execute: async ({ limit, morphoOnly }) => {
      try {
        const morpho = await fetchMorphoUsdcVaults(limit ?? 10);
        const morphoPools = morpho.map((v) => ({
          protocol: "morpho" as const,
          executable: true,
          pool: v.address,
          project: "morpho",
          vaultAddress: v.address,
          vaultName: v.name,
          chainId: v.chainId,
          chain: v.chainId === 8453 ? "Base" : v.chainId === 1 ? "Ethereum" : String(v.chainId),
          symbol: v.assetSymbol,
          assetAddress: v.assetAddress,
          tvlUsd: v.tvlUsd,
          apy: v.apy * 100,
        }));

        if (morphoOnly) {
          return { pools: morphoPools, note: "Morpho MetaMorpho vaults — use create_action_plan with lend." };
        }

        let llama: Awaited<ReturnType<typeof fetchUsdcYields>> = [];
        try {
          llama = await fetchUsdcYields(limit ?? 10);
        } catch {
          llama = [];
        }

        return {
          pools: [
            ...morphoPools,
            ...llama.map((p) => ({
              ...p,
              protocol: p.project,
              executable: p.project?.toLowerCase().includes("morpho") ?? false,
            })),
          ],
          note: "Morpho rows with vaultAddress are executable via create_action_plan lend. Other DeFiLlama rows are discovery-only.",
        };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "yields_failed",
        };
      }
    },
  });
}
