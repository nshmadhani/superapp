import {
  createDb,
  createConfirm,
  approveConfirm,
  ensureUser,
  hasSupabaseEnv,
  listWallets,
  savePlan,
  upsertExternalWallet,
  pruneAutoImportedWallets,
  pruneAllExternalWallets,
  deleteWallet,
  deleteWalletByAddress,
  consumeConfirm,
  rejectConfirm,
  getPlan,
} from "@cipher/db";
import {
  hashPlan,
  walletDisplayName,
  type Plan,
  type WalletRef,
} from "@cipher/core";
import { memoryStore } from "./memory-store";

function normalizeAddress(address: string, chainFamily: "evm" | "solana") {
  return chainFamily === "evm" ? address.toLowerCase() : address;
}

function withDisplayLabel(w: WalletRef): WalletRef {
  return { ...w, label: walletDisplayName(w) };
}

function hasSupabase() {
  return hasSupabaseEnv();
}

export const store = {
  async listWallets(userId: string): Promise<WalletRef[]> {
    if (!hasSupabase()) {
      return memoryStore.listWallets(userId).map(withDisplayLabel);
    }
    const db = createDb();
    await ensureUser(db, userId);
    return (await listWallets(db, userId)).map(withDisplayLabel);
  },

  async upsertWallet(
    userId: string,
    wallet: {
      id?: string;
      address: string;
      chainFamily: "evm" | "solana";
      source: "external" | "turnkey";
      label?: string;
      turnkeyWalletId?: string;
    },
  ): Promise<WalletRef> {
    const address = normalizeAddress(wallet.address, wallet.chainFamily);
    if (!hasSupabase()) {
      return memoryStore.upsertWallet(userId, {
        id: wallet.id ?? crypto.randomUUID(),
        address,
        chainFamily: wallet.chainFamily,
        source: wallet.source,
        label: wallet.label,
      });
    }
    const db = createDb();
    await ensureUser(db, userId);
    if (wallet.source === "external") {
      return upsertExternalWallet(
        db,
        userId,
        address,
        wallet.chainFamily,
        wallet.label,
      );
    }
    const { data, error } = await db
      .from("wallets")
      .upsert(
        {
          user_id: userId,
          address,
          chain_family: wallet.chainFamily,
          source: "turnkey",
          turnkey_wallet_id: wallet.turnkeyWalletId ?? null,
          label: wallet.label ?? "Turnkey",
        },
        { onConflict: "user_id,address,chain_family" },
      )
      .select("id, address, chain_family, source, label")
      .single();
    if (error) throw error;
    return {
      id: data.id as string,
      address: data.address as string,
      chainFamily: data.chain_family as "evm" | "solana",
      source: data.source as "external" | "turnkey",
      label: (data.label as string | null) ?? undefined,
    };
  },

  async pruneAutoImported(userId: string) {
    if (!hasSupabase()) return { deleted: 0 };
    const db = createDb();
    return pruneAutoImportedWallets(db, userId);
  },

  async pruneAllExternal(userId: string) {
    if (!hasSupabase()) return { deleted: 0 };
    const db = createDb();
    return pruneAllExternalWallets(db, userId);
  },

  async deleteWallet(userId: string, walletId: string) {
    if (!hasSupabase()) {
      memoryStore.deleteWallet(userId, walletId);
      return;
    }
    const db = createDb();
    await deleteWallet(db, userId, walletId);
  },

  async deleteWalletByAddress(
    userId: string,
    address: string,
    opts?: { externalOnly?: boolean },
  ) {
    if (!hasSupabase()) {
      const list = memoryStore.listWallets(userId);
      for (const w of list) {
        const match =
          w.address.toLowerCase() === address.toLowerCase() &&
          (opts?.externalOnly === false || w.source === "external");
        if (match) memoryStore.deleteWallet(userId, w.id);
      }
      return { deleted: 1 };
    }
    const db = createDb();
    return deleteWalletByAddress(db, userId, address, opts);
  },

  async savePlan(userId: string, plan: Plan) {
    if (!hasSupabase()) return memoryStore.savePlan(userId, plan);
    const db = createDb();
    await ensureUser(db, userId);
    return savePlan(db, userId, plan);
  },

  async createConfirm(planId: string, planHash: string, expiresAt: string) {
    if (!hasSupabase()) {
      return memoryStore.createConfirm(planId, planHash, expiresAt);
    }
    const db = createDb();
    return createConfirm(db, planId, planHash, expiresAt);
  },

  async approveConfirm(
    planId: string,
    confirmId: string,
    planHash: string,
    userId: string,
  ) {
    if (!hasSupabase()) {
      return memoryStore.approveConfirm(planId, confirmId, planHash, userId);
    }
    const db = createDb();
    return approveConfirm(db, { planId, confirmId, planHash, userId });
  },

  async getPlan(planId: string) {
    if (!hasSupabase()) return memoryStore.getPlan(planId);
    const db = createDb();
    const row = await getPlan(db, planId);
    const plan = row.plan_json as Plan;
    return {
      plan,
      planHash: row.plan_hash as string,
      userId: row.user_id as string,
    };
  },

  async consumeConfirm(confirmId: string, expectedHash: string) {
    if (!hasSupabase()) {
      return memoryStore.consumeConfirm(confirmId, expectedHash);
    }
    const db = createDb();
    return consumeConfirm(db, confirmId, expectedHash);
  },

  async rejectConfirm(
    planId: string,
    confirmId: string,
    planHash: string,
    userId: string,
  ) {
    if (!hasSupabase()) {
      return memoryStore.rejectConfirm(planId, confirmId, planHash, userId);
    }
    const db = createDb();
    return rejectConfirm(db, { planId, confirmId, planHash, userId });
  },

  hashPlan,
};
