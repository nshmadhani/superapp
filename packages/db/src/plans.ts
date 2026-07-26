import type { SupabaseClient } from "@supabase/supabase-js";
import { hashPlan, type Plan, type PlanUnsignedTx } from "@cipher/core";

export async function savePlan(
  db: SupabaseClient,
  userId: string,
  plan: Plan,
) {
  const planHash = hashPlan(plan);
  const { data, error } = await db
    .from("plans")
    .insert({
      id: plan.id,
      user_id: userId,
      wallet_id: plan.walletId,
      plan_json: plan,
      plan_hash: planHash,
      status: "awaiting_confirm",
      expires_at: plan.expiresAt,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { planId: data.id as string, planHash };
}

export async function createConfirm(
  db: SupabaseClient,
  planId: string,
  planHash: string,
  expiresAt: string,
) {
  const { data, error } = await db
    .from("plan_confirms")
    .insert({ plan_id: planId, plan_hash: planHash, expires_at: expiresAt })
    .select("confirm_id")
    .single();
  if (error) throw error;
  return data.confirm_id as string;
}

export async function getPlan(db: SupabaseClient, planId: string) {
  const { data, error } = await db
    .from("plans")
    .select("*")
    .eq("id", planId)
    .single();
  if (error) throw error;
  return data;
}

/**
 * UI Confirm: mark confirm approved + plan confirmed. Does not consume.
 * Returns stored unsigned tx for the client to sign.
 */
export async function approveConfirm(
  db: SupabaseClient,
  opts: {
    planId: string;
    confirmId: string;
    planHash: string;
    userId: string;
  },
): Promise<{
  planId: string;
  planHash: string;
  unsignedTx: PlanUnsignedTx;
  walletAddress: string;
  walletId: string;
}> {
  const { data: planRow, error: planErr } = await db
    .from("plans")
    .select("id, user_id, wallet_id, plan_json, plan_hash, expires_at, status")
    .eq("id", opts.planId)
    .eq("user_id", opts.userId)
    .single();
  if (planErr || !planRow) throw new Error("plan_not_found");
  if (planRow.plan_hash !== opts.planHash) throw new Error("Plan hash mismatch");
  if (new Date(planRow.expires_at as string).getTime() < Date.now()) {
    throw new Error("Plan expired");
  }

  const { data: confirm, error: confErr } = await db
    .from("plan_confirms")
    .select("*")
    .eq("confirm_id", opts.confirmId)
    .eq("plan_id", opts.planId)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();
  if (confErr || !confirm) throw new Error("Invalid or expired confirmId");
  if (confirm.plan_hash !== opts.planHash) throw new Error("Plan hash mismatch");

  if (!confirm.approved_at) {
    const { error: apprErr } = await db
      .from("plan_confirms")
      .update({ approved_at: new Date().toISOString() })
      .eq("confirm_id", opts.confirmId);
    if (apprErr) throw apprErr;
  }

  await db
    .from("plans")
    .update({ status: "confirmed" })
    .eq("id", opts.planId);

  const plan = planRow.plan_json as Plan;
  const unsignedTx = plan.unsignedTx;
  if (!unsignedTx) throw new Error("plan_missing_unsigned_tx");

  const { data: wallet, error: wErr } = await db
    .from("wallets")
    .select("id, address")
    .eq("id", planRow.wallet_id)
    .single();
  if (wErr || !wallet) throw new Error("wallet_not_found");

  return {
    planId: opts.planId,
    planHash: opts.planHash,
    unsignedTx,
    walletAddress: wallet.address as string,
    walletId: wallet.id as string,
  };
}

export async function consumeConfirm(
  db: SupabaseClient,
  confirmId: string,
  expectedHash: string,
) {
  const { data, error } = await db
    .from("plan_confirms")
    .select("*")
    .eq("confirm_id", confirmId)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();
  if (error || !data) throw new Error("Invalid or expired confirmId");
  if (data.plan_hash !== expectedHash) throw new Error("Plan hash mismatch");
  if (!data.approved_at) {
    throw new Error("Confirm not approved in UI");
  }
  const { error: updateError } = await db
    .from("plan_confirms")
    .update({ consumed_at: new Date().toISOString() })
    .eq("confirm_id", confirmId);
  if (updateError) throw updateError;

  await db
    .from("plans")
    .update({ status: "executed" })
    .eq("id", data.plan_id);

  return data.plan_id as string;
}
