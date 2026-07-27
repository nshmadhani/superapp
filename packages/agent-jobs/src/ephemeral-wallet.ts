import { randomBytes } from "node:crypto";
import { getPublicKey } from "@noble/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { AgentWallet } from "./types";

function toHex(bytes: Uint8Array): `0x${string}` {
  return `0x${bytesToHex(bytes)}`;
}

/**
 * Ephemeral EVM wallet for an agent run (no Turnkey).
 * Avoids viem subpath imports that Turbopack fails to resolve from this package.
 */
export function createEphemeralAgentWallet(label?: string): AgentWallet {
  const priv = randomBytes(32);
  const publicKey = getPublicKey(priv, false); // 65-byte uncompressed
  const addressBytes = keccak_256(publicKey.slice(1)).slice(-20);
  const address = toHex(addressBytes);
  const privateKey = toHex(priv);
  const short = address.slice(2, 8);
  return {
    address,
    chainFamily: "evm",
    label: label?.trim() || `Agent wallet ${short}`,
    source: "ephemeral",
    privateKey,
  };
}
