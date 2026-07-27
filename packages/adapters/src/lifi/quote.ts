import {
  convertQuoteToRoute,
  getQuote,
  type LiFiStep,
  type Route,
} from "@lifi/sdk";
import { chainFamilyForLifiChain } from "./chains";
import { createLifiClient } from "./client";
import {
  estimateAmountUsd,
  recommendLifiSlippage,
} from "./slippage";
import { LIFI_NATIVE_TOKEN, resolveLifiToken } from "./tokens";

export type LifiTransferRequest = {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  toAddress?: string;
  /** 0–1 (e.g. 0.05 = 5%). Omit to auto-pick (higher for small cross-chain). */
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
  /** Slippage actually used for this quote (0–1). */
  slippage: number;
  slippageReason?: string;
  estimatedFromUsd?: number | null;
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
    gasLimit?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };
};

function bigIntishToString(v: unknown): string {
  if (v == null) return "0";
  if (typeof v === "bigint") return v.toString();
  return String(v);
}

function optionalHexQuantity(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  const s = String(v);
  return s.length > 0 ? s : undefined;
}

function sameAddress(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function quoteLifiTransfer(
  req: LifiTransferRequest,
): Promise<LifiTransferQuote> {
  const fromFamily = chainFamilyForLifiChain(req.fromChainId);
  const toFamily = chainFamilyForLifiChain(req.toChainId);
  if (!fromFamily || !toFamily) {
    throw new Error("unsupported_lifi_chain");
  }

  const fromToken = resolveLifiToken(req.fromChainId, req.fromToken);
  const toToken = resolveLifiToken(req.toChainId, req.toToken);

  // Same-chain native→native (or identical token) is a noop — LI.FI rejects
  // it, or worse, agents may pass buyToken=ETH on HyperEVM (999) meaning
  // Base gas and get a useless same-chain route.
  if (
    req.fromChainId === req.toChainId &&
    sameAddress(fromToken, toToken)
  ) {
    throw new Error(
      `noop_same_asset: ${req.fromToken} → ${req.toToken} on chain ${req.fromChainId}. ` +
        `For Base ETH gas from HyperEVM use fromChainId=999, toChainId=8453, sellToken=HYPE, buyToken=ETH.`,
    );
  }

  // buyToken=ETH with toChainId=999 is HyperEVM ERC-20 ETH, not Base native.
  if (
    req.toChainId === 999 &&
    req.toToken.trim().toUpperCase() === "ETH" &&
    toToken !== LIFI_NATIVE_TOKEN
  ) {
    throw new Error(
      `ambiguous_eth_on_hyperevm: buyToken=ETH on HyperEVM (999) is an ERC-20, not Base gas. ` +
        `To bridge HYPE → Base ETH set toChainId=8453 and buyToken=ETH.`,
    );
  }

  const client = createLifiClient();
  const toAddress = req.toAddress ?? req.fromAddress;

  // Probe quote (or use agent slippage) so we can size slippage from USD notional.
  const probeSlippage =
    req.slippage != null && Number.isFinite(req.slippage)
      ? req.slippage
      : recommendLifiSlippage({
          fromChainId: req.fromChainId,
          toChainId: req.toChainId,
          amountUsd: null,
          requested: null,
        }).slippage;

  let step = await getQuote(client, {
    fromChain: req.fromChainId,
    toChain: req.toChainId,
    fromToken,
    toToken,
    fromAmount: req.fromAmount,
    fromAddress: req.fromAddress,
    toAddress,
    slippage: probeSlippage,
  });

  const estimatedFromUsd = estimateAmountUsd(
    req.fromAmount,
    step.action?.fromToken?.decimals,
    step.action?.fromToken?.priceUSD,
  );
  const slip = recommendLifiSlippage({
    fromChainId: req.fromChainId,
    toChainId: req.toChainId,
    amountUsd: estimatedFromUsd,
    requested: req.slippage,
  });

  // Re-quote when auto-bump differs from the probe (small cross-chain gas top-ups).
  if (Math.abs(slip.slippage - probeSlippage) > 1e-9) {
    step = await getQuote(client, {
      fromChain: req.fromChainId,
      toChain: req.toChainId,
      fromToken,
      toToken,
      fromAmount: req.fromAmount,
      fromAddress: req.fromAddress,
      toAddress,
      slippage: slip.slippage,
    });
  }

  const actionFrom = step.action?.fromChainId ?? req.fromChainId;
  const actionTo = step.action?.toChainId ?? req.toChainId;
  if (actionFrom !== req.fromChainId || actionTo !== req.toChainId) {
    throw new Error(
      `lifi_chain_mismatch: requested ${req.fromChainId}→${req.toChainId} but quote returned ${actionFrom}→${actionTo}`,
    );
  }

  const route = convertQuoteToRoute(step);
  const toAmount = step.estimate?.toAmount ?? "0";
  const minBuyAmount = step.estimate?.toAmountMin ?? toAmount;
  const fromSym = step.action.fromToken.symbol ?? req.fromToken.slice(0, 8);
  const toSym = step.action.toToken.symbol ?? req.toToken.slice(0, 8);
  const isCrossChain = req.fromChainId !== req.toChainId;

  // Guard: quote resolved to the same fungible on the same chain (e.g. refund-shaped).
  const quotedFrom = step.action.fromToken.address ?? fromToken;
  const quotedTo = step.action.toToken.address ?? toToken;
  if (
    !isCrossChain &&
    sameAddress(String(quotedFrom), String(quotedTo)) &&
    fromSym.toUpperCase() === toSym.toUpperCase()
  ) {
    throw new Error(
      `noop_same_asset_quote: LI.FI returned ${fromSym}→${toSym} on ${req.fromChainId}. ` +
        `Request a real destination chain (e.g. HyperEVM HYPE → Base ETH: 999→8453).`,
    );
  }

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
        // Preserve LI.FI gas hints — HyperEVM quotes use legacy gasPrice.
        gasLimit: optionalHexQuantity(tx?.gasLimit),
        gasPrice: optionalHexQuantity(tx?.gasPrice),
        maxFeePerGas: optionalHexQuantity(tx?.maxFeePerGas),
        maxPriorityFeePerGas: optionalHexQuantity(tx?.maxPriorityFeePerGas),
      }
    : undefined;

  return {
    adapterId: "lifi",
    fromChainId: req.fromChainId,
    toChainId: req.toChainId,
    fromToken,
    toToken,
    fromAmount: req.fromAmount,
    toAmount,
    minBuyAmount,
    // Always brand as LI.FI in the product UI. Raw `tool` is kept for status polling.
    displayRoute: isCrossChain
      ? `${fromSym} (${req.fromChainId}) → ${toSym} (${req.toChainId}) via LI.FI`
      : `${fromSym} → ${toSym} via LI.FI`,
    tool: step.tool,
    toolName: "LI.FI",
    executionDurationSec: step.estimate?.executionDuration ?? 0,
    isCrossChain,
    slippage: slip.slippage,
    slippageReason: slip.reason,
    estimatedFromUsd,
    step,
    route,
    unsignedTx,
  };
}
