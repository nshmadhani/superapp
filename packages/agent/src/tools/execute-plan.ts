import { tool } from "ai";
import { z } from "zod";
import { store } from "../store";
import type { AgentContext } from "./index";

export function executePlanTool(_ctx: AgentContext) {
  return tool({
    description:
      "Finalize a plan after the user clicked Confirm in Transaction Review. Requires an approved confirmId. Returns the stored unsigned EVM transaction for the client/Turnkey to sign — does not invent calldata.",
    inputSchema: z.object({
      confirmId: z.string(),
      planId: z.string(),
      planHash: z.string(),
    }),
    execute: async (input) => {
      try {
        const planId = await store.consumeConfirm(
          input.confirmId,
          input.planHash,
        );
        if (planId !== input.planId) {
          return { error: "plan_id_mismatch" };
        }
        const stored = await store.getPlan(planId);
        if (!stored) return { error: "plan_not_found" };
        const tx = stored.plan.unsignedTx;
        if (!tx) return { error: "plan_missing_unsigned_tx" };

        return {
          type: "unsigned_tx" as const,
          planId,
          chainId: tx.chainId,
          transaction: {
            to: tx.to,
            data: tx.data,
            value: tx.value,
          },
          walletId: stored.plan.walletId,
          message:
            "User already confirmed in UI. Sign/send with Turnkey or the connected wallet.",
        };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "execute_failed",
        };
      }
    },
  });
}
