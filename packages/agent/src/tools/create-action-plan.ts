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
import { isAddressSignable, toSignableSet } from "../signable";
import type { AgentContext } from "./index";

/**
 * Multi-leg action plan: optional LI.FI transfer + optional Morpho lend.
 * Lend-only when USDC (and gas) already sit on the Morpho chain — do NOT
 * invent a swap/bridge leg.
 */
export function createActionPlanTool(ctx: AgentContext) {
  return tool({
    description:
      "Create a confirm-gated action plan for Morpho lend and/or an optional LI.FI transfer. " +
      "LEND ONLY: when the user already has USDC on Base/Ethereum and native gas, set lend and OMIT transfer fields (no fromChainId/sellToken/sellAmount). Produces Morpho approve + deposit only — do NOT invent a swap or bridge. " +
      "TRANSFER + LEND: set transfer fields AND lend when funds must move first (cross-chain bridge or same-chain swap into USDC), then Morpho. " +
      "Never require a gas bridge if get_portfolio already shows ETH/native on the lend chain. Does not broadcast.",
    inputSchema: z
      .object({
        /** Required for a LI.FI leg; omit entirely for Morpho-only. */
        sourceWalletId: z
          .string()
          .optional()
          .describe("Wallet that signs the swap/bridge — omit for lend-only"),
        fromChainId: z.number().int().optional(),
        toChainId: z.number().int().optional(),
        sellToken: z.string().optional(),
        buyToken: z
          .string()
          .optional()
          .describe("Usually USDC when lending afterward"),
        sellAmount: z.string().optional().describe("Base units"),
        slippage: z
          .number()
          .min(0.001)
          .max(0.5)
          .optional()
          .describe(
            "LI.FI slippage 0–1. Small cross-chain top-ups need 0.03–0.05; omit to auto-bump.",
          ),
        toAddress: z
          .string()
          .optional()
          .describe("Bridge recipient; defaults to source or lend wallet"),
        lend: z
          .object({
            walletId: z
              .string()
              .describe(
                "EVM wallet that signs Morpho approve+deposit (and holds USDC)",
              ),
            chainId: z
              .number()
              .int()
              .optional()
              .describe("Defaults to toChainId or 8453"),
            vaultAddress: z
              .string()
              .optional()
              .describe("Morpho vault; omit to pick top listed USDC vault"),
            amount: z
              .string()
              .describe(
                "USDC base units to lend. Required for lend-only; for transfer+lend defaults to LI.FI toAmount if omitted.",
              )
              .optional(),
          })
          .optional()
          .describe("Morpho approve + deposit legs"),
        summary: z.string().optional(),
      })
      .superRefine((val, ctx) => {
        const hasTransfer =
          val.sourceWalletId != null &&
          val.fromChainId != null &&
          val.toChainId != null &&
          val.sellToken != null &&
          val.buyToken != null &&
          val.sellAmount != null;
        const hasLend = val.lend != null;
        if (!hasTransfer && !hasLend) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Provide either a LI.FI transfer (sourceWalletId, chains, tokens, amount) and/or lend.",
          });
        }
        if (hasLend && !hasTransfer && !val.lend?.amount) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "lend.amount is required for Morpho-only plans.",
            path: ["lend", "amount"],
          });
        }
        if (
          !hasTransfer &&
          (val.sourceWalletId != null ||
            val.fromChainId != null ||
            val.sellToken != null)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Partial transfer fields — either pass a full transfer or omit all transfer fields for lend-only.",
          });
        }
      }),
    execute: async (input) => {
      const wallets = await store.listWallets(ctx.userId);
      const signable = toSignableSet(ctx.signableAddresses);

      const hasTransfer =
        input.sourceWalletId != null &&
        input.fromChainId != null &&
        input.toChainId != null &&
        input.sellToken != null &&
        input.buyToken != null &&
        input.sellAmount != null;

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
      if (
        lendWallet &&
        isAddressSignable(signable, lendWallet.address) === false
      ) {
        return {
          error: "lend_wallet_not_signable",
          walletId: lendWallet.id,
          address: lendWallet.address,
          label: lendWallet.label,
          message: `${lendWallet.label ?? "Lend wallet"} must be signable in the live session for Morpho approve+deposit. Reconnect it or use a signable EVM wallet.`,
        };
      }

      let source = hasTransfer
        ? wallets.find((w) => w.id === input.sourceWalletId)
        : lendWallet;
      if (hasTransfer && !source) {
        return { error: "wallet_not_found", walletId: input.sourceWalletId };
      }
      if (!source) {
        return { error: "wallet_not_found", message: "No signing wallet." };
      }
      if (isAddressSignable(signable, source.address) === false) {
        return {
          error: "wallet_not_signable",
          walletId: source.id,
          address: source.address,
          label: source.label,
          message: `${source.label ?? "Wallet"} is not connected in the live Turnkey session.`,
        };
      }

      try {
        const steps: PlanStep[] = [];
        const stepExecutions: PlanStepExecution[] = [];
        let quoteDisplay: string | undefined;
        let quoteMinBuy: string | undefined;
        let quoteToAmount: string | undefined;
        let quoteFromChain = input.fromChainId;
        let quoteToChain = input.toChainId;
        let quoteTool: string | undefined;
        let quoteToolName: string | undefined;
        let quoteDuration: number | undefined;
        let quoteIsCross = false;
        let lifiStep: unknown;
        let lifiRoute: unknown;
        let transferTx: PlanUnsignedTx | undefined;

        if (hasTransfer) {
          const fromFamily = chainFamilyForLifiChain(input.fromChainId!);
          if (!fromFamily) {
            return {
              error: "unsupported_from_chain",
              chainId: input.fromChainId,
            };
          }
          if (source.chainFamily !== fromFamily) {
            return {
              error: "wallet_chain_mismatch",
              message: `Source wallet is ${source.chainFamily} but fromChainId is ${fromFamily}.`,
            };
          }

          const toAddress =
            input.toAddress ?? lendWallet?.address ?? source.address;

          const quote = await quoteLifiTransfer({
            fromChainId: input.fromChainId!,
            toChainId: input.toChainId!,
            fromToken: input.sellToken!,
            toToken: input.buyToken!,
            fromAmount: input.sellAmount!,
            fromAddress: source.address,
            toAddress,
            slippage: input.slippage,
          });

          const stepType = quote.isCrossChain ? "bridge" : "swap";
          quoteDisplay = quote.displayRoute;
          quoteMinBuy = quote.minBuyAmount;
          quoteToAmount = quote.toAmount;
          quoteFromChain = quote.fromChainId;
          quoteToChain = quote.toChainId;
          quoteTool = quote.tool;
          quoteToolName = quote.toolName;
          quoteDuration = quote.executionDurationSec;
          quoteIsCross = quote.isCrossChain;
          lifiStep = quote.step;
          lifiRoute = quote.route;

          steps.push({
            type: stepType,
            walletId: source.id,
            fromChainId: input.fromChainId!,
            toChainId: input.toChainId!,
            sellToken: input.sellToken!,
            buyToken: input.buyToken!,
            sellAmount: input.sellAmount!,
            minBuyAmount: quote.minBuyAmount,
            adapterId: "lifi",
            tool: quote.tool,
            label: quote.displayRoute,
          });

          transferTx = quote.unsignedTx
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

          if (!transferTx) {
            // Fall back to fields on the LI.FI step so we never push an empty leg.
            const txReq = (
              quote.step as
                | {
                    transactionRequest?: {
                      to?: string;
                      data?: string;
                      value?: string | number | bigint;
                      chainId?: number;
                      gasLimit?: string | number;
                      gasPrice?: string | number;
                      maxFeePerGas?: string | number;
                      maxPriorityFeePerGas?: string | number;
                    };
                  }
                | undefined
            )?.transactionRequest;
            const data =
              txReq?.data != null && String(txReq.data).length > 0
                ? String(txReq.data)
                : undefined;
            if (data) {
              transferTx = {
                to: txReq?.to != null ? String(txReq.to) : "",
                data,
                value: String(txReq?.value ?? "0"),
                chainId: Number(txReq?.chainId ?? input.fromChainId),
                gasLimit:
                  txReq?.gasLimit != null ? String(txReq.gasLimit) : undefined,
                gasPrice:
                  txReq?.gasPrice != null ? String(txReq.gasPrice) : undefined,
                maxFeePerGas:
                  txReq?.maxFeePerGas != null
                    ? String(txReq.maxFeePerGas)
                    : undefined,
                maxPriorityFeePerGas:
                  txReq?.maxPriorityFeePerGas != null
                    ? String(txReq.maxPriorityFeePerGas)
                    : undefined,
                minBuyAmount: quote.minBuyAmount,
                displayRoute: quote.displayRoute,
                tool: quote.tool,
                toolName: quote.toolName,
                toChainId: quote.toChainId,
                executionDurationSec: quote.executionDurationSec,
                isCrossChain: quote.isCrossChain,
              };
            }
          }

          if (!transferTx) {
            return { error: "lifi_missing_transaction" };
          }

          stepExecutions.push({
            stepIndex: 0,
            walletId: source.id,
            kind: stepType,
            label: quote.displayRoute,
            unsignedTx: transferTx,
            lifiStep: quote.step,
            lifiRoute: quote.route,
            waitForLifi: quote.isCrossChain,
          });
        }

        let lendSummary: string | undefined;
        if (input.lend && lendWallet) {
          const lendChainId =
            input.lend.chainId ?? input.toChainId ?? 8453;
          const lendAmount =
            input.lend.amount ?? quoteToAmount;
          if (!lendAmount) {
            return {
              error: "lend_amount_required",
              message:
                "lend.amount is required when there is no LI.FI transfer to size the deposit from.",
            };
          }
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

        if (stepExecutions.length === 0) {
          return { error: "empty_plan" };
        }

        const now = Date.now();
        const summaryParts = [
          ...(quoteDisplay ? [quoteDisplay] : []),
          ...(lendSummary ? [lendSummary] : []),
        ];
        const plan: Plan = {
          id: randomUUID(),
          walletId: source.id,
          steps,
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 15 * 60_000).toISOString(),
          summary: input.summary ?? summaryParts.join(" → "),
          unsignedTx: stepExecutions[0]?.unsignedTx,
          lifiStep,
          lifiRoute,
          stepExecutions,
        };

        const { planId, planHash } = await store.savePlan(ctx.userId, plan);
        const confirmId = await store.createConfirm(
          planId,
          planHash,
          plan.expiresAt,
        );

        const walletById = Object.fromEntries(wallets.map((w) => [w.id, w]));
        const lendOnly = !hasTransfer && Boolean(input.lend);
        const gasNote =
          input.lend && quoteIsCross
            ? "Ensure the lend wallet has native gas (ETH on Base/Ethereum) for Morpho approve+deposit after the bridge."
            : input.lend
              ? "Lend wallet needs a little native ETH on this chain for approve+deposit. If get_portfolio already shows ETH, no gas bridge is needed."
              : undefined;

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
            minBuyAmount: quoteMinBuy ?? stepExecutions[0]?.unsignedTx.value ?? "0",
            displayRoute: plan.summary ?? quoteDisplay ?? lendSummary ?? "Action plan",
            chainId: quoteFromChain ?? stepExecutions[0]?.unsignedTx.chainId ?? 8453,
            toChainId: quoteToChain ?? quoteFromChain,
            tool: quoteTool,
            toolName: quoteToolName ?? (lendOnly ? "Morpho" : "LI.FI"),
            executionDurationSec: quoteDuration,
            isCrossChain: quoteIsCross,
            toAmount: quoteToAmount,
            multiStep: stepExecutions.length > 1,
            stepCount: stepExecutions.length,
            lendOnly,
          },
          wallet: source,
          wallets: walletById,
          gasNote,
          message: lendOnly
            ? `Show Transaction Review with ${stepExecutions.length} Morpho signature steps (approve + deposit). No LI.FI swap/bridge — funds already on-chain.`
            : stepExecutions.length > 1
              ? `Show Transaction Review with ${stepExecutions.length} signature steps. User confirms once, then signs each leg in order. ${gasNote ?? ""}`
              : "Show Transaction Review. User confirms once, then signs with Turnkey.",
        };
      } catch (err) {
        return {
          error:
            err instanceof Error ? err.message : "create_action_plan_failed",
        };
      }
    },
  });
}
