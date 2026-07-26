import { tool } from "ai";
import { z } from "zod";
import { store } from "../store";

export function simulatePlanTool() {
  return tool({
    description:
      "Re-check a stored plan before confirm: expiry, swap/bridge step sanity, and liquidity warnings from the stored LiFi quote.",
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
      if (!step || (step.type !== "swap" && step.type !== "bridge")) {
        return {
          kind: "estimated" as const,
          ok: false,
          warnings: ["Only swap/bridge plans are supported."],
        };
      }

      const warnings: string[] = [];
      const tx = stored.plan.unsignedTx;
      if (!stored.plan.lifiStep && !tx?.data) {
        warnings.push("Missing LiFi quote — recreate the plan.");
      }
      if (tx) {
        try {
          const minOut = BigInt(tx.minBuyAmount || "0");
          if (minOut === BigInt(0)) {
            warnings.push(
              "Min buy amount is 0 — liquidity may be thin; review carefully.",
            );
          }
        } catch {
          warnings.push("Could not parse quote amounts for liquidity check.");
        }
        if (tx.isCrossChain) {
          warnings.push(
            "Cross-chain bridge: funds arrive on the destination after bridge finality; track status after signing.",
          );
        }
      }

      const msLeft = new Date(stored.plan.expiresAt).getTime() - Date.now();
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
        fromChainId: step.fromChainId ?? step.chainId,
        toChainId: step.toChainId,
        tool: tx?.toolName ?? step.tool,
      };
    },
  });
}
