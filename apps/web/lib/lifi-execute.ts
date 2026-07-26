"use client";

import { isLifiEvmChain, isLifiSolanaChain } from "@cipher/core";
import { Connection, VersionedTransaction } from "@solana/web3.js";

export type TurnkeyEvmSend = (params: {
  transaction: Record<string, unknown>;
}) => Promise<unknown>;

export type TurnkeyWalletAccount = {
  address: string;
  addressFormat?: string;
};

/** Turnkey sign only — we broadcast ourselves (base64 raw tx). */
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

/**
 * Refresh blockhash, Turnkey-sign, then broadcast via JSON-RPC base64.
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

export function findWalletAccount(
  wallets: Array<{ accounts?: TurnkeyWalletAccount[] | null }>,
  address: string,
): TurnkeyWalletAccount | undefined {
  const needle = address.trim();
  for (const w of wallets) {
    for (const a of w.accounts ?? []) {
      if (a.address === needle) return a;
    }
  }
  return undefined;
}

/**
 * Client-side: sign/send the source-chain tx via Turnkey only.
 * - EVM → handleSendTransaction
 * - Solana → signTransaction + our RPC broadcast (base64)
 */
export async function executeLifiAfterConfirm(opts: {
  lifiStep?: unknown;
  unsignedTx?: TxFields;
  walletAddress: string;
  handleSendTransaction: TurnkeyEvmSend;
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
    const sent = await opts.handleSendTransaction({
      transaction: {
        from: opts.walletAddress,
        to,
        data,
        value,
        caip2: `eip155:${chainId}`,
      },
    });
    return { mode: "turnkey", txHash: extractTxHash(sent) };
  }

  if (data && isLifiSolanaChain(chainId)) {
    const walletAccount = opts.walletAccount;
    if (!walletAccount) {
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

function extractTxHash(sent: unknown): string | undefined {
  if (!sent || typeof sent !== "object") return undefined;
  const o = sent as Record<string, unknown>;
  for (const key of ["hash", "txHash", "transactionHash", "id"]) {
    const v = o[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  const nested = o.transaction ?? o.result;
  if (nested && typeof nested === "object") {
    return extractTxHash(nested);
  }
  return undefined;
}
