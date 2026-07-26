import { tool } from "ai";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { quoteEvmSwap } from "@cipher/adapters";
import type { Plan } from "@cipher/core";
import { store } from "../store";
import type { AgentContext } from "./index";

export function createPlanTool(ctx: AgentContext) {
  return tool({
    description:
      "Create a confirm-gated swap plan. Quotes via 0x, stores plan hash, returns confirmId + review payload for the Transaction Review UI. Does not send a transaction. User must click Confirm in the UI before execute_plan.",
    inputSchema: z.object({
      walletId: z.string().describe("Cipher wallet id from list_wallets"),
      chainId: z.number().int().describe("EVM chain id, e.g. 8453 for Base"),
      sellToken: z.string().describe("Sell token contract address"),
      buyToken: z.string().describe("Buy token contract address"),
      sellAmount: z
        .string()
        .describe("Sell amount in base units (wei / token decimals)"),
      summary: z.string().optional(),
    }),
    execute: async (input) => {
      const wallets = await store.listWallets(ctx.userId);
      const wallet = wallets.find((w) => w.id === input.walletId);
      if (!wallet) {
        return { error: "wallet_not_found", walletId: input.walletId };
      }
      if (wallet.chainFamily !== "evm") {
        return {
          error: "evm_wallet_required",
          message: "Phase 1 swaps require an EVM wallet.",
        };
      }

      try {
        const quote = await quoteEvmSwap({
          chainId: input.chainId,
          sellToken: input.sellToken,
          buyToken: input.buyToken,
          sellAmount: input.sellAmount,
          taker: wallet.address,
        });

        const now = Date.now();
        const plan: Plan = {
          id: randomUUID(),
          walletId: wallet.id,
          steps: [
            {
              type: "swap",
              chainId: input.chainId,
              sellToken: input.sellToken,
              buyToken: input.buyToken,
              sellAmount: input.sellAmount,
              minBuyAmount: quote.minBuyAmount,
              adapterId: "evm-swap",
            },
          ],
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 10 * 60_000).toISOString(),
          summary: input.summary ?? quote.displayRoute,
          unsignedTx: {
            to: quote.to,
            data: quote.data,
            value: quote.value,
            chainId: quote.chainId,
            minBuyAmount: quote.minBuyAmount,
            displayRoute: quote.displayRoute,
          },
        };

        const { planId, planHash } = await store.savePlan(ctx.userId, plan);
        const confirmId = await store.createConfirm(
          planId,
          planHash,
          plan.expiresAt,
        );

        return {
          type: "plan_review" as const,
          confirmId,
          planId,
          planHash,
          plan,
          quote: {
            to: quote.to,
            data: quote.data,
            value: quote.value,
            minBuyAmount: quote.minBuyAmount,
            displayRoute: quote.displayRoute,
            chainId: quote.chainId,
          },
          wallet,
          message:
            "Show Transaction Review. User must click Confirm in the UI before any execute_plan call.",
        };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "create_plan_failed",
        };
      }
    },
  });
}
