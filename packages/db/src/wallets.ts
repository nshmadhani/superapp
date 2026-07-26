import type { SupabaseClient } from "@supabase/supabase-js";
import type { WalletRef } from "@cipher/core";

export async function listWallets(
  db: SupabaseClient,
  userId: string,
): Promise<WalletRef[]> {
  const { data, error } = await db
    .from("wallets")
    .select("id, address, chain_family, source, label")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    address: row.address as string,
    chainFamily: row.chain_family as "evm" | "solana",
    source: row.source as "external" | "turnkey",
    label: (row.label as string | null) ?? undefined,
  }));
}

function normalizeAddress(address: string, chainFamily: "evm" | "solana") {
  return chainFamily === "evm" ? address.toLowerCase() : address;
}

export async function upsertExternalWallet(
  db: SupabaseClient,
  userId: string,
  address: string,
  chainFamily: "evm" | "solana",
  label?: string,
) {
  const normalized = normalizeAddress(address, chainFamily);
  const { data, error } = await db
    .from("wallets")
    .upsert(
      {
        user_id: userId,
        address: normalized,
        chain_family: chainFamily,
        source: "external",
        label: label ?? null,
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
  } satisfies WalletRef;
}

/**
 * Remove Browser auto-imports and case-variant EVM duplicates.
 * Safe to run on every auth — does not remove intentional Connect wallets.
 */
export async function pruneAutoImportedWallets(
  db: SupabaseClient,
  userId: string,
) {
  const { data: rows, error } = await db
    .from("wallets")
    .select("id, address, chain_family, source, label")
    .eq("user_id", userId);
  if (error) throw error;

  const toDelete = new Set<string>();
  const seenEvm = new Map<string, { id: string; address: string }>();

  for (const row of rows ?? []) {
    const id = row.id as string;
    const source = row.source as string;
    const label = ((row.label as string | null) ?? "").trim();
    const address = row.address as string;
    const chain = row.chain_family as string;

    if (source === "external" && /^browser$/i.test(label)) {
      toDelete.add(id);
      continue;
    }

    if (chain === "evm") {
      const key = address.toLowerCase();
      const kept = seenEvm.get(key);
      if (!kept) {
        seenEvm.set(key, { id, address });
      } else if (kept.id !== id) {
        if (address !== key) toDelete.add(id);
        else {
          toDelete.add(kept.id);
          seenEvm.set(key, { id, address });
        }
      }
    }
  }

  if (toDelete.size === 0) return { deleted: 0 };
  const { error: delErr } = await db
    .from("wallets")
    .delete()
    .eq("user_id", userId)
    .in("id", [...toDelete]);
  if (delErr) throw delErr;
  return { deleted: toDelete.size };
}

/** One-shot cleanup: drop every external wallet (re-connect via modal). */
export async function pruneAllExternalWallets(
  db: SupabaseClient,
  userId: string,
) {
  const { data, error } = await db
    .from("wallets")
    .delete()
    .eq("user_id", userId)
    .eq("source", "external")
    .select("id");
  if (error) throw error;
  return { deleted: data?.length ?? 0 };
}

export async function deleteWallet(
  db: SupabaseClient,
  userId: string,
  walletId: string,
) {
  const { error } = await db
    .from("wallets")
    .delete()
    .eq("user_id", userId)
    .eq("id", walletId);
  if (error) throw error;
}

/** Remove connected/external Cipher rows for an address (EVM case-insensitive). */
export async function deleteWalletByAddress(
  db: SupabaseClient,
  userId: string,
  address: string,
  opts: { externalOnly?: boolean } = {},
) {
  const externalOnly = opts.externalOnly ?? true;
  let q = db.from("wallets").delete().eq("user_id", userId);
  if (externalOnly) q = q.eq("source", "external");

  const lower = address.toLowerCase();
  if (lower.startsWith("0x")) {
    const { data: rows, error: listErr } = await db
      .from("wallets")
      .select("id, address, source")
      .eq("user_id", userId);
    if (listErr) throw listErr;
    const ids = (rows ?? [])
      .filter((r) => {
        if (externalOnly && r.source !== "external") return false;
        return String(r.address).toLowerCase() === lower;
      })
      .map((r) => r.id as string);
    if (ids.length === 0) return { deleted: 0 };
    const { error } = await db
      .from("wallets")
      .delete()
      .eq("user_id", userId)
      .in("id", ids);
    if (error) throw error;
    return { deleted: ids.length };
  }

  const { data, error } = await q.eq("address", address).select("id");
  if (error) throw error;
  return { deleted: data?.length ?? 0 };
}

export async function ensureUser(db: SupabaseClient, userId?: string) {
  if (userId) {
    const { data } = await db
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (data) return data.id as string;
    const { data: inserted, error } = await db
      .from("users")
      .insert({ id: userId })
      .select("id")
      .single();
    if (error) throw error;
    return inserted.id as string;
  }
  const { data, error } = await db.from("users").insert({}).select("id").single();
  if (error) throw error;
  return data.id as string;
}
