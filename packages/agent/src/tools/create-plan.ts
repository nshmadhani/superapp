import { tool } from "ai";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { quoteLifiTransfer } from "@cipher/adapters";
import { chainFamilyForLifiChain, type Plan } from "@cipher/core";
import { store } from "../store";
import { isAddressSignable, toSignableSet } from "../signable";
import type { AgentContext } from "./index";

export function createPlanTool(ctx: AgentContext) {
  return tool({
    description:
      "Create a confirm-gated LI.FI transfer plan ONLY (same-chain swap or cross-chain bridge). Do NOT use this for Morpho/lend/vault deposits — use create_action_plan with lend instead. Do not invent other bridges. Does not send a transaction. Same-chain ERC20→native (e.g. USDC→ETH) still requires native gas on the source chain — never use this to 'buy gas' when the wallet has ~0 native; bridge native from elsewhere or tell the user to top up ETH first.",
    inputSchema: z.object({
      walletId: z.string().describe("Cipher wallet id from list_wallets (source)"),
      fromChainId: z
        .number()
        .int()
        .describe(
          "LI.FI source chain id (e.g. 999 HyperEVM, 8453 Base, 1 Ethereum, 1151111081099710 Solana)",
        ),
      toChainId: z
        .number()
        .int()
        .describe(
          "LI.FI destination chain id. For HyperEVM HYPE → Base ETH gas use 8453 (NOT 999). Same as fromChainId only for a real same-chain swap to a different token.",
        ),
      sellToken: z
        .string()
        .describe("Sell token address or symbol (HYPE, USDC, SOL, …)"),
      buyToken: z
        .string()
        .describe(
          "Buy token address or symbol. For Base gas use ETH with toChainId=8453 — never buyToken=ETH with toChainId=999.",
        ),
      sellAmount: z
        .string()
        .describe("Sell amount in base units (smallest token unit)"),
      slippage: z
        .number()
        .min(0.001)
        .max(0.5)
        .optional()
        .describe(
          "LI.FI slippage 0–1. For small cross-chain gas top-ups (~$1–25) use 0.03–0.05. Omit to auto-bump (default 0.5% same-chain; ~3–5% small bridges).",
        ),
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

      const signable = toSignableSet(ctx.signableAddresses);
      if (isAddressSignable(signable, wallet.address) === false) {
        return {
          error: "wallet_not_signable",
          walletId: wallet.id,
          address: wallet.address,
          label: wallet.label,
          message: `${wallet.label ?? "Wallet"} is linked in Ervo but not connected in the live Turnkey session, so Confirm cannot sign. Ask the user to reconnect it (Wallets → Connect), or pick a signable=true wallet from list_wallets.`,
        };
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
          slippage: input.slippage,
        });

        const now = Date.now();
        const stepType = quote.isCrossChain ? "bridge" : "swap";
        const unsignedTx = quote.unsignedTx
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
          : undefined;
        const plan: Plan = {
          id: randomUUID(),
          walletId: wallet.id,
          steps: [
            {
              type: stepType,
              walletId: wallet.id,
              fromChainId: input.fromChainId,
              toChainId: input.toChainId,
              sellToken: input.sellToken,
              buyToken: input.buyToken,
              sellAmount: input.sellAmount,
              minBuyAmount: quote.minBuyAmount,
              adapterId: "lifi",
              tool: quote.tool,
              label: quote.displayRoute,
            },
          ],
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 10 * 60_000).toISOString(),
          summary: input.summary ?? quote.displayRoute,
          unsignedTx,
          lifiStep: quote.step,
          lifiRoute: quote.route,
          stepExecutions: unsignedTx
            ? [
                {
                  stepIndex: 0,
                  walletId: wallet.id,
                  kind: stepType,
                  label: quote.displayRoute,
                  unsignedTx,
                  lifiStep: quote.step,
                  lifiRoute: quote.route,
                  waitForLifi: quote.isCrossChain,
                },
              ]
            : undefined,
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
            slippage: quote.slippage,
            slippageReason: quote.slippageReason,
            estimatedFromUsd: quote.estimatedFromUsd,
          },
          wallet,
          message:
            "Show Transaction Review. User must click Confirm in the UI before any execute_plan / LiFi execution." +
            (quote.slippageReason && quote.slippageReason !== "default"
              ? ` Slippage ${(quote.slippage * 100).toFixed(1)}% (${quote.slippageReason}).`
              : ""),
        };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "create_plan_failed",
        };
      }
    },
  });
}
