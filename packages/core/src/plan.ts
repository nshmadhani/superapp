import { createHash } from "node:crypto";

export type PlanStep =
  | {
      type: "swap" | "bridge";
      fromChainId: number;
      toChainId: number;
      sellToken: string;
      buyToken: string;
      sellAmount: string;
      minBuyAmount: string;
      adapterId: string;
      tool?: string;
      /** @deprecated use fromChainId — kept for older plans */
      chainId?: number;
    }
  | {
      type: "transfer";
      chainId: number;
      token: string;
      to: string;
      amount: string;
      adapterId: string;
    };

/** Quoted calldata stored with the plan — not part of the plan hash. */
export type PlanUnsignedTx = {
  to: string;
  data: string;
  value: string;
  chainId: number;
  minBuyAmount: string;
  displayRoute: string;
  tool?: string;
  toolName?: string;
  toChainId?: number;
  executionDurationSec?: number;
  isCrossChain?: boolean;
};

export type Plan = {
  id: string;
  walletId: string;
  steps: PlanStep[];
  createdAt: string;
  expiresAt: string;
  summary?: string;
  /** Source-chain tx + review fields. Omitted from hashPlan. */
  unsignedTx?: PlanUnsignedTx;
  /** Serialized LiFi step for SDK execute / status. Omitted from hashPlan. */
  lifiStep?: unknown;
  /** Serialized LiFi route for executeRoute. Omitted from hashPlan. */
  lifiRoute?: unknown;
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
