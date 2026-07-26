import { hashPlan, type Plan, type PlanUnsignedTx } from "@cipher/core";

type StoredPlan = {
  plan: Plan;
  planHash: string;
  userId: string;
};

type StoredConfirm = {
  confirmId: string;
  planId: string;
  planHash: string;
  expiresAt: string;
  approvedAt?: string;
  consumedAt?: string;
};

const plans = new Map<string, StoredPlan>();
const confirms = new Map<string, StoredConfirm>();
const walletsByUser = new Map<
  string,
  Array<{
    id: string;
    address: string;
    chainFamily: "evm" | "solana";
    source: "external" | "turnkey";
    label?: string;
  }>
>();

export const memoryStore = {
  listWallets(userId: string) {
    return walletsByUser.get(userId) ?? [];
  },
  upsertWallet(
    userId: string,
    wallet: {
      id: string;
      address: string;
      chainFamily: "evm" | "solana";
      source: "external" | "turnkey";
      label?: string;
    },
  ) {
    const list = walletsByUser.get(userId) ?? [];
    const idx = list.findIndex(
      (w) =>
        w.address.toLowerCase() === wallet.address.toLowerCase() &&
        w.chainFamily === wallet.chainFamily,
    );
    if (idx >= 0) list[idx] = wallet;
    else list.push(wallet);
    walletsByUser.set(userId, list);
    return wallet;
  },
  savePlan(userId: string, plan: Plan) {
    const planHash = hashPlan(plan);
    plans.set(plan.id, { plan, planHash, userId });
    return { planId: plan.id, planHash };
  },
  createConfirm(planId: string, planHash: string, expiresAt: string) {
    const confirmId = crypto.randomUUID();
    confirms.set(confirmId, { confirmId, planId, planHash, expiresAt });
    return confirmId;
  },
  getPlan(planId: string) {
    return plans.get(planId);
  },
  approveConfirm(
    planId: string,
    confirmId: string,
    planHash: string,
    userId: string,
  ): {
    planId: string;
    planHash: string;
    unsignedTx: PlanUnsignedTx;
    walletAddress: string;
    walletId: string;
  } {
    const stored = plans.get(planId);
    if (!stored || stored.userId !== userId) throw new Error("plan_not_found");
    if (stored.planHash !== planHash) throw new Error("Plan hash mismatch");
    if (new Date(stored.plan.expiresAt).getTime() < Date.now()) {
      throw new Error("Plan expired");
    }
    const row = confirms.get(confirmId);
    if (!row || row.consumedAt || row.planId !== planId) {
      throw new Error("Invalid or expired confirmId");
    }
    if (new Date(row.expiresAt).getTime() < Date.now()) {
      throw new Error("Invalid or expired confirmId");
    }
    if (row.planHash !== planHash) throw new Error("Plan hash mismatch");
    row.approvedAt = row.approvedAt ?? new Date().toISOString();

    const unsignedTx = stored.plan.unsignedTx;
    if (!unsignedTx) throw new Error("plan_missing_unsigned_tx");

    const wallets = walletsByUser.get(userId) ?? [];
    const wallet = wallets.find((w) => w.id === stored.plan.walletId);
    if (!wallet) throw new Error("wallet_not_found");

    return {
      planId,
      planHash,
      unsignedTx,
      walletAddress: wallet.address,
      walletId: wallet.id,
    };
  },
  deleteWallet(userId: string, walletId: string) {
    const list = (walletsByUser.get(userId) ?? []).filter((w) => w.id !== walletId);
    walletsByUser.set(userId, list);
  },
  consumeConfirm(confirmId: string, expectedHash: string) {
    const row = confirms.get(confirmId);
    if (!row || row.consumedAt) throw new Error("Invalid or expired confirmId");
    if (new Date(row.expiresAt).getTime() < Date.now()) {
      throw new Error("Invalid or expired confirmId");
    }
    if (row.planHash !== expectedHash) throw new Error("Plan hash mismatch");
    if (!row.approvedAt) throw new Error("Confirm not approved in UI");
    row.consumedAt = new Date().toISOString();
    return row.planId;
  },
};
