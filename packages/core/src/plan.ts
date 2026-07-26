import { createHash } from "node:crypto";

export type PlanStep =
  | {
      type: "swap" | "bridge";
      /** Wallet that signs this leg (defaults to plan.walletId when omitted). */
      walletId?: string;
      fromChainId: number;
      toChainId: number;
      sellToken: string;
      buyToken: string;
      sellAmount: string;
      minBuyAmount: string;
      adapterId: string;
      tool?: string;
      label?: string;
      /** @deprecated use fromChainId — kept for older plans */
      chainId?: number;
    }
  | {
      type: "approve";
      walletId?: string;
      chainId: number;
      token: string;
      spender: string;
      amount: string;
      adapterId: string;
      label?: string;
    }
  | {
      type: "lend";
      walletId?: string;
      chainId: number;
      protocol: "morpho";
      vaultAddress: string;
      vaultName?: string;
      assetAddress: string;
      amount: string;
      adapterId: string;
      apy?: number;
      label?: string;
    }
  | {
      type: "transfer";
      walletId?: string;
      chainId: number;
      token: string;
      to: string;
      amount: string;
      adapterId: string;
      label?: string;
    };

/** Quoted calldata stored with the plan — not part of the plan hash. */
export type PlanUnsignedTx = {
  to: string;
  data: string;
  value: string;
  chainId: number;
  minBuyAmount?: string;
  displayRoute?: string;
  tool?: string;
  toolName?: string;
  toChainId?: number;
  executionDurationSec?: number;
  isCrossChain?: boolean;
};

/** Per-leg execution payload (parallel to steps). Omitted from hashPlan. */
export type PlanStepExecution = {
  stepIndex: number;
  walletId: string;
  kind: PlanStep["type"];
  label: string;
  unsignedTx: PlanUnsignedTx;
  lifiStep?: unknown;
  lifiRoute?: unknown;
  /** After signing, wait for LI.FI DONE before the next leg. */
  waitForLifi?: boolean;
};

export type Plan = {
  id: string;
  /** Primary / first-leg wallet (DB column + back-compat). */
  walletId: string;
  steps: PlanStep[];
  createdAt: string;
  expiresAt: string;
  summary?: string;
  /** Source-chain tx + review fields for step 0. Omitted from hashPlan. */
  unsignedTx?: PlanUnsignedTx;
  /** Serialized LiFi step for SDK execute / status. Omitted from hashPlan. */
  lifiStep?: unknown;
  /** Serialized LiFi route for executeRoute. Omitted from hashPlan. */
  lifiRoute?: unknown;
  /** Multi-leg execution sequence. Omitted from hashPlan. */
  stepExecutions?: PlanStepExecution[];
};

export function hashPlan(plan: Plan): string {
  const canonical = JSON.stringify({
    walletId: plan.walletId,
    steps: plan.steps,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export type ConfirmToken = {
  confirmId: string;
  planId: string;
  planHash: string;
  expiresAt: string;
};
