import { tool } from "ai";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { quoteLifiTransfer } from "@cipher/adapters";
import { chainFamilyForLifiChain, type Plan } from "@cipher/core";
import { store } from "../store";
import type { AgentContext } from "./index";

export function createPlanTool(ctx: AgentContext) {
  return tool({
    description:
      "Create a confirm-gated transfer plan via LI.FI only (same-chain swap or cross-chain bridge, including to HyperEVM chain id 999). Do not use other bridges. Works for EVM and Solana sources. Stores plan hash and returns confirmId + review payload. Does not send a transaction. User must click Confirm in the UI before execute_plan.",
    inputSchema: z.object({
      walletId: z.string().describe("Ervo wallet id from list_wallets (source)"),
      fromChainId: z
        .number()
        .int()
        .describe(
          "LI.FI source chain id (e.g. 8453 Base, 1 Ethereum, 1151111081099710 Solana)",
        ),
      toChainId: z
        .number()
        .int()
        .describe(
          "LI.FI destination chain id (e.g. 999 HyperEVM, 8453 Base; same as fromChainId for same-chain swap)",
        ),
      sellToken: z
        .string()
        .describe("Sell token address or symbol (USDC, SOL, …)"),
      buyToken: z
        .string()
        .describe("Buy token address or symbol"),
      sellAmount: z
        .string()
        .describe("Sell amount in base units (smallest token unit)"),
      toAddress: z
        .string()
        .optional()
        .describe(
          "Destination recipient address. For cross-family bridges, use an address from list_wallets (e.g. user's EVM wallet for HyperEVM). Defaults to source wallet address.",
        ),
      summary: z.string().optional(),
    }),
    execute: async (input) => {
      const wallets = await store.listWallets(ctx.userId);
      const wallet = wallets.find((w) => w.id === input.walletId);
      if (!wallet) {
        return { error: "wallet_not_found", walletId: input.walletId };
      }

      const fromFamily = chainFamilyForLifiChain(input.fromChainId);
      if (!fromFamily) {
        return { error: "unsupported_from_chain", chainId: input.fromChainId };
      }
      if (wallet.chainFamily !== fromFamily) {
        return {
          error: "wallet_chain_mismatch",
          message: `Wallet is ${wallet.chainFamily} but fromChainId is ${fromFamily}. Pick a matching wallet.`,
        };
      }

      try {
        const quote = await quoteLifiTransfer({
          fromChainId: input.fromChainId,
          toChainId: input.toChainId,
          fromToken: input.sellToken,
          toToken: input.buyToken,
          fromAmount: input.sellAmount,
          fromAddress: wallet.address,
          toAddress: input.toAddress ?? wallet.address,
        });

        const now = Date.now();
        const stepType = quote.isCrossChain ? "bridge" : "swap";
        const plan: Plan = {
          id: randomUUID(),
          walletId: wallet.id,
          steps: [
            {
              type: stepType,
              fromChainId: input.fromChainId,
              toChainId: input.toChainId,
              sellToken: input.sellToken,
              buyToken: input.buyToken,
              sellAmount: input.sellAmount,
              minBuyAmount: quote.minBuyAmount,
              adapterId: "lifi",
              tool: quote.tool,
            },
          ],
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 10 * 60_000).toISOString(),
          summary: input.summary ?? quote.displayRoute,
          unsignedTx: quote.unsignedTx
            ? {
                ...quote.unsignedTx,
                minBuyAmount: quote.minBuyAmount,
                displayRoute: quote.displayRoute,
                tool: quote.tool,
                toolName: quote.toolName,
                toChainId: quote.toChainId,
                executionDurationSec: quote.executionDurationSec,
                isCrossChain: quote.isCrossChain,
              }
            : undefined,
          lifiStep: quote.step,
          lifiRoute: quote.route,
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
            to: quote.unsignedTx?.to ?? "",
            data: quote.unsignedTx?.data ?? "",
            value: quote.unsignedTx?.value ?? "0",
            minBuyAmount: quote.minBuyAmount,
            displayRoute: quote.displayRoute,
            chainId: quote.fromChainId,
            toChainId: quote.toChainId,
            tool: quote.tool,
            toolName: quote.toolName,
            executionDurationSec: quote.executionDurationSec,
            isCrossChain: quote.isCrossChain,
            toAmount: quote.toAmount,
          },
          wallet,
          message:
            "Show Transaction Review. User must click Confirm in the UI before any execute_plan / LiFi execution.",
        };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "create_plan_failed",
        };
      }
    },
  });
}
