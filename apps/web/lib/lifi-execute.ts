"use client";

import { isLifiEvmChain, isLifiSolanaChain } from "@cipher/core";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import {
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  serializeTransaction,
  type Hex,
  type TransactionSerializableEIP1559,
  type TransactionSerializableLegacy,
} from "viem";

export type TurnkeyWalletAccount = {
  address: string;
  addressFormat?: string;
};

/** Turnkey sign only — we broadcast ourselves. */
export type TurnkeySignTransaction = (params: {
  walletAccount: TurnkeyWalletAccount;
  unsignedTransaction: string;
  transactionType: "TRANSACTION_TYPE_SOLANA" | "TRANSACTION_TYPE_ETHEREUM";
}) => Promise<string>;

type TxFields = {
  to?: string;
  data?: string;
  value?: string;
  chainId?: number;
  gasLimit?: string | number;
  gasPrice?: string | number;
  maxFeePerGas?: string | number;
  maxPriorityFeePerGas?: string | number;
};

function nonEmpty(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v);
  return s.length > 0 ? s : undefined;
}

function bytesFromTxData(raw: string): Uint8Array {
  if (raw.startsWith("0x")) {
    const hex = raw.slice(2);
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }
  const binary = atob(raw);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toBigInt(v: string | number | undefined): bigint | undefined {
  if (v == null || v === "") return undefined;
  try {
    return BigInt(v);
  } catch {
    return undefined;
  }
}

function toHexQuantity(n: bigint): Hex {
  return `0x${n.toString(16)}` as Hex;
}

async function evmRpc(
  chainId: number,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const res = await fetch("/api/evm/rpc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chainId, method, params }),
  });
  const body = (await res.json()) as { result?: unknown; error?: string };
  if (!res.ok || body.error) {
    throw new Error(
      typeof body.error === "string" ? body.error : `EVM RPC ${method} failed`,
    );
  }
  return body.result;
}

/**
 * Build unsigned EVM tx → Turnkey signTransaction → eth_sendRawTransaction
 * via our QuickNode proxy. Does NOT use Turnkey ethSendTransaction
 * (org feature often disabled → ETH_SEND_TRANSACTION_ERROR).
 */
export async function signAndBroadcastEvm(opts: {
  from: string;
  to: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit?: string | number;
  gasPrice?: string | number;
  maxFeePerGas?: string | number;
  maxPriorityFeePerGas?: string | number;
  walletAccount: TurnkeyWalletAccount;
  signTransaction: TurnkeySignTransaction;
}): Promise<string> {
  const nonceHex = (await evmRpc(opts.chainId, "eth_getTransactionCount", [
    opts.from,
    "pending",
  ])) as string;
  const nonce = Number(nonceHex);
  if (!Number.isFinite(nonce)) {
    throw new Error(`Invalid nonce from RPC: ${nonceHex}`);
  }

  const value = toBigInt(opts.value) ?? BigInt(0);
  const data = (
    opts.data.startsWith("0x") ? opts.data : `0x${opts.data}`
  ) as Hex;
  const to = opts.to as `0x${string}`;

  let gas = toBigInt(opts.gasLimit);
  if (gas == null) {
    const estimated = (await evmRpc(opts.chainId, "eth_estimateGas", [
      {
        from: opts.from,
        to,
        data,
        value: toHexQuantity(value),
      },
    ])) as string;
    gas = (BigInt(estimated) * BigInt(120)) / BigInt(100);
  }

  const providedMaxFee = toBigInt(opts.maxFeePerGas);
  const providedPriority = toBigInt(opts.maxPriorityFeePerGas);
  const providedGasPrice = toBigInt(opts.gasPrice);

  let unsignedHex: string;

  if (providedMaxFee != null || providedPriority != null || providedGasPrice == null) {
    let maxPriorityFeePerGas = providedPriority;
    let maxFeePerGas = providedMaxFee;

    if (maxPriorityFeePerGas == null || maxFeePerGas == null) {
      try {
        const tipHex = (await evmRpc(
          opts.chainId,
          "eth_maxPriorityFeePerGas",
          [],
        )) as string;
        maxPriorityFeePerGas = maxPriorityFeePerGas ?? BigInt(tipHex);
        const block = (await evmRpc(opts.chainId, "eth_getBlockByNumber", [
          "latest",
          false,
        ])) as { baseFeePerGas?: string } | null;
        const base = BigInt(block?.baseFeePerGas ?? "0x0");
        maxFeePerGas =
          maxFeePerGas ??
          base * BigInt(2) + (maxPriorityFeePerGas ?? BigInt(0));
      } catch {
        const gp = BigInt(
          (await evmRpc(opts.chainId, "eth_gasPrice", [])) as string,
        );
        maxPriorityFeePerGas =
          maxPriorityFeePerGas ?? gp / BigInt(10);
        maxFeePerGas = maxFeePerGas ?? gp * BigInt(2);
      }
    }

    const tx: TransactionSerializableEIP1559 = {
      type: "eip1559",
      chainId: opts.chainId,
      nonce,
      to,
      value,
      data,
      gas,
      maxFeePerGas: maxFeePerGas!,
      maxPriorityFeePerGas: maxPriorityFeePerGas!,
    };
    unsignedHex = serializeTransaction(tx);
  } else {
    const tx: TransactionSerializableLegacy = {
      type: "legacy",
      chainId: opts.chainId,
      nonce,
      to,
      value,
      data,
      gas,
      gasPrice: providedGasPrice,
    };
    unsignedHex = serializeTransaction(tx);
  }

  // Turnkey expects hex without 0x for embedded wallets
  const unsignedForTurnkey = unsignedHex.startsWith("0x")
    ? unsignedHex.slice(2)
    : unsignedHex;

  let signed: string;
  try {
    signed = await opts.signTransaction({
      walletAccount: opts.walletAccount,
      unsignedTransaction: unsignedForTurnkey,
      transactionType: "TRANSACTION_TYPE_ETHEREUM",
    });
  } catch (err) {
    const top = err instanceof Error ? err.message : String(err);
    const cause =
      err instanceof Error && err.cause instanceof Error
        ? err.cause.message
        : err instanceof Error && typeof err.cause === "string"
          ? err.cause
          : undefined;
    const detail = cause && cause !== top ? `${top} — ${cause}` : top;
    throw new Error(
      `Turnkey sign failed on chain ${opts.chainId} → ${opts.to}: ${detail}`,
    );
  }
  if (!signed.startsWith("0x")) signed = `0x${signed}`;

  const hash = (await evmRpc(opts.chainId, "eth_sendRawTransaction", [
    signed,
  ])) as string;
  if (!hash || typeof hash !== "string") {
    throw new Error("eth_sendRawTransaction returned empty hash");
  }
  return hash;
}

/**
 * Poll until an EVM tx is mined. Required between Morpho approve → deposit
 * (deposit estimateGas reads allowance; pending approve still looks like 0).
 */
export async function waitForEvmReceipt(opts: {
  chainId: number;
  txHash: string;
  timeoutMs?: number;
  pollMs?: number;
}): Promise<{ status: "success" | "reverted"; blockNumber?: string }> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const pollMs = opts.pollMs ?? 1_200;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const receipt = (await evmRpc(opts.chainId, "eth_getTransactionReceipt", [
      opts.txHash,
    ])) as { status?: string; blockNumber?: string } | null;
    if (receipt?.status != null) {
      const ok = BigInt(receipt.status) === BigInt(1);
      if (!ok) {
        throw new Error(
          `Transaction reverted on-chain (${opts.txHash.slice(0, 10)}…)`,
        );
      }
      return { status: "success", blockNumber: receipt.blockNumber };
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(
    `Timed out waiting for confirmation of ${opts.txHash.slice(0, 10)}…`,
  );
}

/** Parse ERC-20 approve(spender, amount) calldata from an approve leg. */
export function parseErc20ApproveCall(unsignedTx: {
  to?: string;
  data?: string;
}): { token: `0x${string}`; spender: `0x${string}`; amount: bigint } | null {
  if (!unsignedTx.to?.startsWith("0x") || !unsignedTx.data?.startsWith("0x")) {
    return null;
  }
  try {
    const decoded = decodeFunctionData({
      abi: erc20Abi,
      data: unsignedTx.data as Hex,
    });
    if (decoded.functionName !== "approve") return null;
    const [spender, amount] = decoded.args as [`0x${string}`, bigint];
    return {
      token: getAddress(unsignedTx.to) as `0x${string}`,
      spender: getAddress(spender) as `0x${string}`,
      amount,
    };
  } catch {
    return null;
  }
}

/**
 * Receipt alone is not enough across load-balanced RPCs — poll allowance
 * until the approve is visible before Morpho deposit estimateGas.
 */
export async function waitForErc20Allowance(opts: {
  chainId: number;
  token: string;
  owner: string;
  spender: string;
  minAmount: bigint;
  timeoutMs?: number;
  pollMs?: number;
}): Promise<bigint> {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const pollMs = opts.pollMs ?? 1_000;
  const started = Date.now();
  const owner = getAddress(opts.owner);
  const spender = getAddress(opts.spender);
  const token = getAddress(opts.token);
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  });

  while (Date.now() - started < timeoutMs) {
    const result = (await evmRpc(opts.chainId, "eth_call", [
      { to: token, data },
      "latest",
    ])) as string;
    const allowance = BigInt(result || "0x0");
    if (allowance >= opts.minAmount) return allowance;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(
    `Timed out waiting for ERC-20 allowance ≥ ${opts.minAmount.toString()} ` +
      `(token ${token.slice(0, 10)}… spender ${spender.slice(0, 10)}…)`,
  );
}

/**
 * Refresh blockhash, Turnkey-sign, then broadcast via JSON-RPC.
 *
 * Do NOT use Turnkey signAndSendTransaction for Solana: its helper
 * broadcasts with `encoding: "base58"`, which corrupts/rejects large
 * LiFi/Jupiter versioned txs and surfaces as "Blockhash not found".
 */
export async function signAndBroadcastSolana(opts: {
  rawTxData: string;
  rpcUrl: string;
  walletAccount: TurnkeyWalletAccount;
  signTransaction: TurnkeySignTransaction;
}): Promise<string> {
  const connection = new Connection(opts.rpcUrl, "confirmed");
  const tx = VersionedTransaction.deserialize(
    bytesFromTxData(opts.rawTxData),
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.message.recentBlockhash = blockhash;

  const unsignedHex = bytesToHex(tx.serialize());
  const signedHex = await opts.signTransaction({
    walletAccount: opts.walletAccount,
    unsignedTransaction: unsignedHex,
    transactionType: "TRANSACTION_TYPE_SOLANA",
  });

  const signedTx = VersionedTransaction.deserialize(hexToBytes(signedHex));
  const signature = await connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 3,
  });

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  return signature;
}

function addressesEqual(a: string, b: string): boolean {
  if (a.startsWith("0x") || b.startsWith("0x")) {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}

export function findWalletAccount(
  wallets: Array<{ accounts?: TurnkeyWalletAccount[] | null }>,
  address: string,
): TurnkeyWalletAccount | undefined {
  const needle = address.trim();
  for (const w of wallets) {
    for (const a of w.accounts ?? []) {
      if (a.address && addressesEqual(a.address, needle)) return a;
    }
  }
  return undefined;
}

/**
 * Resolve a Turnkey account for signing.
 * Prefers the live kit account (checksummed address + source).
 * Falls back to address-only for embedded wallets — Cipher stores EVM
 * addresses lowercased, and Turnkey signTransaction only needs `signWith`.
 */
export function resolveSignAccount(
  wallets: Array<{ accounts?: TurnkeyWalletAccount[] | null }> | null | undefined,
  address: string,
): TurnkeyWalletAccount {
  const found = findWalletAccount(wallets ?? [], address);
  if (found) {
    // Prefer checksummed address for Turnkey signWith when possible.
    if (found.address?.startsWith("0x")) {
      try {
        return { ...found, address: getAddress(found.address) };
      } catch {
        return found;
      }
    }
    return found;
  }
  if (address.trim().startsWith("0x")) {
    try {
      return { address: getAddress(address.trim()) };
    } catch {
      return { address: address.trim() };
    }
  }
  throw new Error(
    "Turnkey wallet account not found for this address. Reconnect or refresh wallets.",
  );
}

/**
 * Client-side: Turnkey sign only, then broadcast on our RPCs.
 * - EVM → signTransaction + /api/evm/rpc (QuickNode)
 * - Solana → signTransaction + Solana RPC
 */
export async function executeLifiAfterConfirm(opts: {
  lifiStep?: unknown;
  unsignedTx?: TxFields;
  walletAddress: string;
  signTransaction: TurnkeySignTransaction;
  walletAccount?: TurnkeyWalletAccount;
  solanaRpcUrl: string;
}): Promise<{ mode: "turnkey"; txHash?: string }> {
  const step = opts.lifiStep as
    | { transactionRequest?: TxFields }
    | undefined;
  const txReq = step?.transactionRequest;

  const to = nonEmpty(opts.unsignedTx?.to) ?? nonEmpty(txReq?.to);
  const data = nonEmpty(opts.unsignedTx?.data) ?? nonEmpty(txReq?.data);
  const value =
    nonEmpty(opts.unsignedTx?.value) ?? nonEmpty(txReq?.value) ?? "0";
  const chainId = Number(
    opts.unsignedTx?.chainId ?? txReq?.chainId ?? 0,
  );

  if (to && data && isLifiEvmChain(chainId)) {
    const walletAccount = opts.walletAccount;
    if (!walletAccount?.address) {
      throw new Error(
        "EVM Turnkey wallet account not found for this address. Reconnect or refresh wallets.",
      );
    }
    const txHash = await signAndBroadcastEvm({
      from: opts.walletAddress,
      to,
      data,
      value,
      chainId,
      gasLimit: opts.unsignedTx?.gasLimit ?? txReq?.gasLimit,
      gasPrice: opts.unsignedTx?.gasPrice ?? txReq?.gasPrice,
      maxFeePerGas: opts.unsignedTx?.maxFeePerGas ?? txReq?.maxFeePerGas,
      maxPriorityFeePerGas:
        opts.unsignedTx?.maxPriorityFeePerGas ?? txReq?.maxPriorityFeePerGas,
      walletAccount,
      signTransaction: opts.signTransaction,
    });
    return { mode: "turnkey", txHash };
  }

  if (data && isLifiSolanaChain(chainId)) {
    const walletAccount = opts.walletAccount;
    if (!walletAccount?.address) {
      throw new Error(
        "Solana Turnkey wallet account not found for this address. Reconnect or refresh wallets.",
      );
    }
    if (!opts.solanaRpcUrl) {
      throw new Error("Missing Solana RPC URL (NEXT_PUBLIC_SOLANA_RPC_URL)");
    }
    const txHash = await signAndBroadcastSolana({
      rawTxData: data,
      rpcUrl: opts.solanaRpcUrl,
      walletAccount,
      signTransaction: opts.signTransaction,
    });
    return { mode: "turnkey", txHash };
  }

  throw new Error(
    "No executable source-chain transaction on this plan. Re-quote via create_plan.",
  );
}
