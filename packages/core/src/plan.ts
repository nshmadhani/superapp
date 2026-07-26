import { createHash } from "node:crypto";

export type PlanStep =
  | {
      type: "swap";
      chainId: number;
      sellToken: string;
      buyToken: string;
      sellAmount: string;
      minBuyAmount: string;
      adapterId: string;
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
};

export type Plan = {
  id: string;
  walletId: string;
  steps: PlanStep[];
  createdAt: string;
  expiresAt: string;
  summary?: string;
  /** 0x quote payload for confirm → sign. Omitted from hashPlan. */
  unsignedTx?: PlanUnsignedTx;
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
