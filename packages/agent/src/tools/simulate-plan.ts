import { tool } from "ai";
import { z } from "zod";
import { store } from "../store";

export function simulatePlanTool() {
  return tool({
    description:
      "Re-check a stored plan before confirm: expiry, swap step sanity, and liquidity/slippage warnings from the stored quote.",
    inputSchema: z.object({
      planId: z.string(),
    }),
    execute: async ({ planId }) => {
      const stored = await store.getPlan(planId);
      if (!stored) return { error: "plan_not_found" };
      const expired = new Date(stored.plan.expiresAt).getTime() < Date.now();
      if (expired) {
        return {
          kind: "unverifiable" as const,
          ok: false,
          warnings: ["Plan expired; create a new plan."],
        };
      }
      const step = stored.plan.steps[0];
      if (!step || step.type !== "swap") {
        return {
          kind: "estimated" as const,
          ok: false,
          warnings: ["Only swap plans are supported in Phase 1."],
        };
      }

      const warnings: string[] = [];
      const tx = stored.plan.unsignedTx;
      if (!tx) {
        warnings.push("Missing stored quote calldata — recreate the plan.");
      } else {
        try {
          const minOut = BigInt(tx.minBuyAmount || "0");
          if (minOut === BigInt(0)) {
            warnings.push(
              "Min buy amount is 0 — liquidity may be thin; review carefully.",
            );
          }
          const sell = BigInt(step.sellAmount || "0");
          if (
            sell > BigInt(0) &&
            minOut > BigInt(0) &&
            minOut * BigInt(100) < sell
          ) {
            // Heuristic when both are raw units of different tokens — soft warn only
            warnings.push(
              "Quoted min out looks small relative to sell amount — check slippage and token decimals.",
            );
          }
        } catch {
          warnings.push("Could not parse quote amounts for liquidity check.");
        }
      }

      const msLeft =
        new Date(stored.plan.expiresAt).getTime() - Date.now();
      if (msLeft < 2 * 60_000) {
        warnings.push("Quote expires in under 2 minutes.");
      }

      return {
        kind: "quoted" as const,
        ok: warnings.length === 0,
        warnings,
        planHash: stored.planHash,
        summary: stored.plan.summary,
        displayRoute: tx?.displayRoute,
        minBuyAmount: tx?.minBuyAmount,
        chainId: tx?.chainId ?? step.chainId,
      };
    },
  });
}
