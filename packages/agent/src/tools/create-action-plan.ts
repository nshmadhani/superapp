import { tool } from "ai";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { quoteLifiTransfer, quoteMorphoLend } from "@cipher/adapters";
import {
  chainFamilyForLifiChain,
  type Plan,
  type PlanStep,
  type PlanStepExecution,
  type PlanUnsignedTx,
} from "@cipher/core";
import { store } from "../store";
import type { AgentContext } from "./index";

/**
 * Multi-leg action plan: LI.FI swap/bridge (+ optional Morpho lend on dest).
 * One confirm, then sequential multi-wallet signing in the UI.
 */
export function createActionPlanTool(ctx: AgentContext) {
  return tool({
    description:
      "Create a confirm-gated multi-step action plan: LI.FI swap or bridge, optionally followed by Morpho USDC lend (approve + deposit) on the destination wallet. Use when the user wants to move funds and lend in one flow across wallets. Returns plan_review for Transaction Review. Does not broadcast.",
    inputSchema: z.object({
      sourceWalletId: z
        .string()
        .describe("Wallet that signs the swap/bridge (from list_wallets)"),
      fromChainId: z.number().int(),
      toChainId: z.number().int(),
      sellToken: z.string(),
      buyToken: z.string().describe("Usually USDC when lending afterward"),
      sellAmount: z.string().describe("Base units"),
      toAddress: z
        .string()
        .optional()
        .describe("Bridge recipient; defaults to source or lend wallet"),
      lend: z
        .object({
          walletId: z
            .string()
            .describe(
              "EVM wallet that receives funds and signs Morpho approve+deposit (often dest wallet)",
            ),
          chainId: z
            .number()
            .int()
            .optional()
            .describe("Defaults to toChainId"),
          vaultAddress: z
            .string()
            .optional()
            .describe("Morpho vault; omit to pick top listed USDC vault"),
          amount: z
            .string()
            .optional()
            .describe("Defaults to LI.FI toAmount from the transfer leg"),
        })
        .optional()
        .describe("When set, append Morpho approve + deposit after transfer settles"),
      summary: z.string().optional(),
    }),
    execute: async (input) => {
      const wallets = await store.listWallets(ctx.userId);
      const source = wallets.find((w) => w.id === input.sourceWalletId);
      if (!source) {
        return { error: "wallet_not_found", walletId: input.sourceWalletId };
      }

      const fromFamily = chainFamilyForLifiChain(input.fromChainId);
      if (!fromFamily) {
        return { error: "unsupported_from_chain", chainId: input.fromChainId };
      }
      if (source.chainFamily !== fromFamily) {
        return {
          error: "wallet_chain_mismatch",
          message: `Source wallet is ${source.chainFamily} but fromChainId is ${fromFamily}.`,
        };
      }

      const lendWallet = input.lend
        ? wallets.find((w) => w.id === input.lend!.walletId)
        : undefined;
      if (input.lend && !lendWallet) {
        return { error: "lend_wallet_not_found", walletId: input.lend.walletId };
      }
      if (lendWallet && lendWallet.chainFamily !== "evm") {
        return {
          error: "lend_wallet_must_be_evm",
          message: "Morpho lend requires an EVM wallet.",
        };
      }

      const toAddress =
        input.toAddress ??
        lendWallet?.address ??
        source.address;

      try {
        const quote = await quoteLifiTransfer({
          fromChainId: input.fromChainId,
          toChainId: input.toChainId,
          fromToken: input.sellToken,
          toToken: input.buyToken,
          fromAmount: input.sellAmount,
          fromAddress: source.address,
          toAddress,
        });

        const stepType = quote.isCrossChain ? "bridge" : "swap";
        const steps: PlanStep[] = [
          {
            type: stepType,
            walletId: source.id,
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
        ];

        const transferTx: PlanUnsignedTx | undefined = quote.unsignedTx
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

        if (!transferTx && !quote.step) {
          return { error: "lifi_missing_transaction" };
        }

        const stepExecutions: PlanStepExecution[] = [
          {
            stepIndex: 0,
            walletId: source.id,
            kind: stepType,
            label: quote.displayRoute,
            unsignedTx: transferTx ?? {
              to: "",
              data: "",
              value: "0",
              chainId: input.fromChainId,
              displayRoute: quote.displayRoute,
              tool: quote.tool,
              toolName: quote.toolName,
              toChainId: quote.toChainId,
              isCrossChain: quote.isCrossChain,
              executionDurationSec: quote.executionDurationSec,
              minBuyAmount: quote.minBuyAmount,
            },
            lifiStep: quote.step,
            lifiRoute: quote.route,
            waitForLifi: quote.isCrossChain,
          },
        ];

        let lendSummary: string | undefined;
        if (input.lend && lendWallet) {
          const lendChainId = input.lend.chainId ?? input.toChainId;
          const lendAmount = input.lend.amount ?? quote.toAmount;
          const morpho = await quoteMorphoLend({
            chainId: lendChainId,
            fromAddress: lendWallet.address as `0x${string}`,
            amount: lendAmount,
            vaultAddress: input.lend.vaultAddress,
            receiver: lendWallet.address as `0x${string}`,
          });
          lendSummary = morpho.displayRoute;

          const approveIndex = steps.length;
          steps.push({
            type: "approve",
            walletId: lendWallet.id,
            chainId: lendChainId,
            token: morpho.vault.assetAddress,
            spender: morpho.vault.address,
            amount: lendAmount,
            adapterId: "morpho",
            label: `Approve ${morpho.vault.assetSymbol} for Morpho`,
          });
          stepExecutions.push({
            stepIndex: approveIndex,
            walletId: lendWallet.id,
            kind: "approve",
            label: `Approve ${morpho.vault.assetSymbol} for ${morpho.vault.name}`,
            unsignedTx: {
              ...morpho.approveTx,
              displayRoute: `Approve ${morpho.vault.assetSymbol}`,
            },
          });

          const lendIndex = steps.length;
          steps.push({
            type: "lend",
            walletId: lendWallet.id,
            chainId: lendChainId,
            protocol: "morpho",
            vaultAddress: morpho.vault.address,
            vaultName: morpho.vault.name,
            assetAddress: morpho.vault.assetAddress,
            amount: lendAmount,
            adapterId: "morpho",
            apy: morpho.vault.apy,
            label: morpho.displayRoute,
          });
          stepExecutions.push({
            stepIndex: lendIndex,
            walletId: lendWallet.id,
            kind: "lend",
            label: morpho.displayRoute,
            unsignedTx: {
              ...morpho.depositTx,
              displayRoute: morpho.displayRoute,
            },
          });
        }

        const now = Date.now();
        const summaryParts = [quote.displayRoute];
        if (lendSummary) summaryParts.push(lendSummary);
        const plan: Plan = {
          id: randomUUID(),
          walletId: source.id,
          steps,
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 15 * 60_000).toISOString(),
          summary: input.summary ?? summaryParts.join(" → "),
          unsignedTx: stepExecutions[0]?.unsignedTx,
          lifiStep: quote.step,
          lifiRoute: quote.route,
          stepExecutions,
        };

        const { planId, planHash } = await store.savePlan(ctx.userId, plan);
        const confirmId = await store.createConfirm(
          planId,
          planHash,
          plan.expiresAt,
        );

        const walletById = Object.fromEntries(wallets.map((w) => [w.id, w]));

        return {
          type: "plan_review" as const,
          confirmId,
          planId,
          planHash,
          plan,
          quote: {
            to: stepExecutions[0]?.unsignedTx.to ?? "",
            data: stepExecutions[0]?.unsignedTx.data ?? "",
            value: stepExecutions[0]?.unsignedTx.value ?? "0",
            minBuyAmount: quote.minBuyAmount,
            displayRoute: plan.summary ?? quote.displayRoute,
            chainId: quote.fromChainId,
            toChainId: quote.toChainId,
            tool: quote.tool,
            toolName: quote.toolName,
            executionDurationSec: quote.executionDurationSec,
            isCrossChain: quote.isCrossChain,
            toAmount: quote.toAmount,
            multiStep: stepExecutions.length > 1,
            stepCount: stepExecutions.length,
          },
          wallet: source,
          wallets: walletById,
          message:
            "Show Transaction Review. User confirms once, then signs each leg (swap/bridge, then Morpho approve + deposit) with the matching wallet.",
        };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "create_action_plan_failed",
        };
      }
    },
  });
}
