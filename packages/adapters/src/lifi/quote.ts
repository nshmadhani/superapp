import {
  convertQuoteToRoute,
  getQuote,
  type LiFiStep,
  type Route,
} from "@lifi/sdk";
import { chainFamilyForLifiChain } from "./chains";
import { createLifiClient } from "./client";

export type LifiTransferRequest = {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  toAddress?: string;
  slippage?: number;
};

export type LifiTransferQuote = {
  adapterId: "lifi";
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  minBuyAmount: string;
  displayRoute: string;
  tool: string;
  toolName: string;
  executionDurationSec: number;
  isCrossChain: boolean;
  /** Full LiFi step (includes transactionRequest when available) */
  step: LiFiStep;
  /** Route for SDK executeRoute */
  route: Route;
  /** EVM source tx fields when present */
  unsignedTx?: {
    to: string;
    data: string;
    value: string;
    chainId: number;
  };
};

function bigIntishToString(v: unknown): string {
  if (v == null) return "0";
  if (typeof v === "bigint") return v.toString();
  return String(v);
}

export async function quoteLifiTransfer(
  req: LifiTransferRequest,
): Promise<LifiTransferQuote> {
  const fromFamily = chainFamilyForLifiChain(req.fromChainId);
  const toFamily = chainFamilyForLifiChain(req.toChainId);
  if (!fromFamily || !toFamily) {
    throw new Error("unsupported_lifi_chain");
  }

  const client = createLifiClient();
  const step = await getQuote(client, {
    fromChain: req.fromChainId,
    toChain: req.toChainId,
    fromToken: req.fromToken,
    toToken: req.toToken,
    fromAmount: req.fromAmount,
    fromAddress: req.fromAddress,
    toAddress: req.toAddress ?? req.fromAddress,
    slippage: req.slippage ?? 0.005,
  });

  const route = convertQuoteToRoute(step);
  const toAmount = step.estimate?.toAmount ?? "0";
  const minBuyAmount = step.estimate?.toAmountMin ?? toAmount;
  const fromSym = step.action.fromToken.symbol ?? req.fromToken.slice(0, 8);
  const toSym = step.action.toToken.symbol ?? req.toToken.slice(0, 8);
  const isCrossChain = req.fromChainId !== req.toChainId;

  const tx = step.transactionRequest;
  // Solana LiFi quotes often have only `data` (base64) — no `to`.
  const data =
    tx?.data != null && String(tx.data).length > 0
      ? String(tx.data)
      : undefined;
  const unsignedTx = data
    ? {
        to: tx?.to != null ? String(tx.to) : "",
        data,
        value: bigIntishToString(tx?.value),
        chainId: Number(tx?.chainId ?? req.fromChainId),
      }
    : undefined;

  return {
    adapterId: "lifi",
    fromChainId: req.fromChainId,
    toChainId: req.toChainId,
    fromToken: req.fromToken,
    toToken: req.toToken,
    fromAmount: req.fromAmount,
    toAmount,
    minBuyAmount,
    displayRoute: isCrossChain
      ? `${fromSym} (${req.fromChainId}) → ${toSym} (${req.toChainId}) via ${step.toolDetails?.name ?? step.tool}`
      : `${fromSym} → ${toSym} via ${step.toolDetails?.name ?? step.tool}`,
    tool: step.tool,
    toolName: step.toolDetails?.name ?? step.tool,
    executionDurationSec: step.estimate?.executionDuration ?? 0,
    isCrossChain,
    step,
    route,
    unsignedTx,
  };
}
