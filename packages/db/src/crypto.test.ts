import { describe, expect, it } from "vitest";
import { decryptPrivateKey, encryptPrivateKey } from "./crypto";

describe("agent wallet crypto", () => {
  it("round-trips a private key", () => {
    const env = { AGENT_WALLET_ENCRYPTION_KEY: "test-passphrase-for-unit" };
    const pk = "0x" + "ab".repeat(32);
    const ct = encryptPrivateKey(pk, env);
    expect(ct.split(":")).toHaveLength(3);
    expect(decryptPrivateKey(ct, env)).toBe(pk);
  });
});
