import { tool } from "ai";
import { z } from "zod";
import { fetchUsdcYields } from "@cipher/defillama";

export function getYieldsTool() {
  return tool({
    description:
      "List high-TVL USDC yield pools from DeFiLlama for research and recommendations.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(25).optional(),
    }),
    execute: async ({ limit }) => {
      try {
        return { pools: await fetchUsdcYields(limit ?? 10) };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "yields_failed",
        };
      }
    },
  });
}
