/**
 * One-off: reclaim orphan agent wallet funds to user's Turnkey EVM wallet.
 * Run from repo root with apps/web/.env.local loaded.
 */
import { createDecipheriv, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  createWalletClient,
  formatEther,
  formatUnits,
  http,
  parseEther,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getEvmPublicClient, resolveEvmRpcUrl } from "@cipher/rpc";

const userId = "43db2340-a08f-42b5-ba88-eeb5109c96aa";
const runId = "60e00d93-2588-4eda-8464-7f18e9667418";

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

function encryptionKey(): Buffer {
  const raw = process.env.AGENT_WALLET_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("Missing AGENT_WALLET_ENCRYPTION_KEY");
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  return createHash("sha256").update(raw).digest();
}

function decryptPrivateKey(ciphertext: string): string {
  const key = encryptionKey();
  const [ivHex, tagHex, dataHex] = ciphertext.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("bad ciphertext");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase env");

const db = createClient(url, key, { auth: { persistSession: false } });

const { data: walletRow, error: wErr } = await db
  .from("agent_wallets")
  .select("*")
  .eq("user_id", userId)
  .eq("agent_run_id", runId)
  .maybeSingle();
if (wErr) throw wErr;
if (!walletRow) throw new Error("agent wallet not found");

const privateKey = decryptPrivateKey(
  String(walletRow.private_key_ciphertext),
) as `0x${string}`;
const agentAddress = String(walletRow.address);
console.log("AGENT_ADDRESS", agentAddress);
console.log("PRIVATE_KEY", privateKey);

const { data: wallets, error: listErr } = await db
  .from("wallets")
  .select("*")
  .eq("user_id", userId);
if (listErr) throw listErr;

const dest = [...(wallets ?? [])]
  .reverse()
  .find(
    (w: { chain_family?: string; source?: string; address?: string }) =>
      w.chain_family === "evm" && w.source === "turnkey",
  );
if (!dest?.address) {
  console.error(
    "NO_DEST",
    (wallets ?? []).map(
      (w: { address?: string; source?: string; chain_family?: string }) => ({
        address: w.address,
        source: w.source,
        chain_family: w.chain_family,
      }),
    ),
  );
  process.exit(2);
}
console.log("DEST", dest.address);

const account = privateKeyToAccount(privateKey);
const chainId = 999;
const publicClient = getEvmPublicClient(chainId);
const walletClient = createWalletClient({
  account,
  chain: publicClient.chain,
  transport: http(resolveEvmRpcUrl(chainId)),
});

const tokUrl = new URL("https://li.quest/v1/token");
tokUrl.searchParams.set("chain", String(chainId));
tokUrl.searchParams.set("token", "USDC");
const tokRes = await fetch(tokUrl);
const tok = (await tokRes.json()) as { address: string; decimals?: number };
console.log("USDC_META", tok.address, tok.decimals);

const usdcBal = (await publicClient.readContract({
  address: tok.address as Hex,
  abi: ERC20_ABI,
  functionName: "balanceOf",
  args: [account.address],
})) as bigint;
const nativeBal = await publicClient.getBalance({ address: account.address });
console.log("BALANCES", {
  usdc: formatUnits(usdcBal, Number(tok.decimals ?? 6)),
  native: formatEther(nativeBal),
});

const txs: Array<Record<string, string>> = [];

if (usdcBal > BigInt(0)) {
  const hash = await walletClient.writeContract({
    address: tok.address as Hex,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [dest.address as Hex, usdcBal],
    chain: publicClient.chain,
  });
  txs.push({ kind: "USDC", hash });
  console.log("USDC_TX", hash);
}

const bal2 = await publicClient.getBalance({ address: account.address });
const gasPrice = await publicClient.getGasPrice();
const gasCost = gasPrice * BigInt(21_000);
const MIN = parseEther("0.00001");
if (bal2 > gasCost + MIN) {
  const value = bal2 - gasCost;
  const hash = await walletClient.sendTransaction({
    to: dest.address as Hex,
    value,
    chain: publicClient.chain,
  });
  txs.push({ kind: "HYPE", hash, value: formatEther(value) });
  console.log("HYPE_TX", hash, formatEther(value));
} else {
  console.log("SKIP_NATIVE", formatEther(bal2));
}

await db
  .from("agent_wallets")
  .update({
    status: "destroyed",
    destroyed_at: new Date().toISOString(),
    private_key_ciphertext: "",
  })
  .eq("user_id", userId)
  .eq("agent_run_id", runId);

console.log("DONE", JSON.stringify(txs));
