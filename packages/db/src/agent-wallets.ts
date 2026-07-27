import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptPrivateKey, encryptPrivateKey } from "./crypto";

export type AgentWalletRow = {
  id: string;
  userId: string;
  agentRunId: string;
  address: string;
  chainFamily: "evm" | "solana";
  label?: string;
  status: "active" | "destroyed";
  privateKeyCiphertext: string;
  createdAt: string;
  destroyedAt?: string;
};

function mapRow(row: Record<string, unknown>): AgentWalletRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    agentRunId: String(row.agent_run_id),
    address: String(row.address),
    chainFamily: row.chain_family === "solana" ? "solana" : "evm",
    label: (row.label as string | null) ?? undefined,
    status: row.status === "destroyed" ? "destroyed" : "active",
    privateKeyCiphertext: String(row.private_key_ciphertext),
    createdAt: String(row.created_at),
    destroyedAt: (row.destroyed_at as string | null) ?? undefined,
  };
}

export async function saveAgentWallet(
  db: SupabaseClient,
  input: {
    userId: string;
    agentRunId: string;
    address: string;
    privateKey: `0x${string}` | string;
    label?: string;
    chainFamily?: "evm" | "solana";
  },
  env: NodeJS.ProcessEnv = process.env,
): Promise<AgentWalletRow> {
  const ciphertext = encryptPrivateKey(input.privateKey, env);
  const { data, error } = await db
    .from("agent_wallets")
    .upsert(
      {
        user_id: input.userId,
        agent_run_id: input.agentRunId,
        address: input.address.toLowerCase(),
        chain_family: input.chainFamily ?? "evm",
        label: input.label ?? null,
        private_key_ciphertext: ciphertext,
        status: "active",
        destroyed_at: null,
      },
      { onConflict: "user_id,agent_run_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function getAgentWalletForRun(
  db: SupabaseClient,
  userId: string,
  agentRunId: string,
): Promise<AgentWalletRow | null> {
  const { data, error } = await db
    .from("agent_wallets")
    .select("*")
    .eq("user_id", userId)
    .eq("agent_run_id", agentRunId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function getAgentWalletPrivateKey(
  db: SupabaseClient,
  userId: string,
  agentRunId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ row: AgentWalletRow; privateKey: `0x${string}` } | null> {
  const row = await getAgentWalletForRun(db, userId, agentRunId);
  if (!row || row.status !== "active") return null;
  const privateKey = decryptPrivateKey(
    row.privateKeyCiphertext,
    env,
  ) as `0x${string}`;
  return { row, privateKey };
}

export async function markAgentWalletDestroyed(
  db: SupabaseClient,
  userId: string,
  agentRunId: string,
  opts?: { wipeCiphertext?: boolean },
): Promise<AgentWalletRow | null> {
  const patch: Record<string, unknown> = {
    status: "destroyed",
    destroyed_at: new Date().toISOString(),
  };
  if (opts?.wipeCiphertext) {
    patch.private_key_ciphertext = "";
  }
  const { data, error } = await db
    .from("agent_wallets")
    .update(patch)
    .eq("user_id", userId)
    .eq("agent_run_id", agentRunId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}
