import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGO = "aes-256-gcm";

function encryptionKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env.AGENT_WALLET_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("Missing AGENT_WALLET_ENCRYPTION_KEY");
  }
  // Accept 64-char hex or any passphrase (hashed to 32 bytes).
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return createHash("sha256").update(raw).digest();
}

/** Encrypt a private key for storage. Format: iv:authTag:ciphertext (hex). */
export function encryptPrivateKey(
  privateKey: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const key = encryptionKey(env);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(privateKey, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptPrivateKey(
  ciphertext: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const key = encryptionKey(env);
  const [ivHex, tagHex, dataHex] = ciphertext.split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("invalid_agent_wallet_ciphertext");
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
