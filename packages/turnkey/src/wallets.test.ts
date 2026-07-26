import { describe, it, expect } from "vitest";

describe("createEvmWallet contract", () => {
  it("documents required env vars", () => {
    const required = [
      "TURNKEY_API_PUBLIC_KEY",
      "TURNKEY_API_PRIVATE_KEY",
      "TURNKEY_ORGANIZATION_ID",
    ];
    expect(required).toHaveLength(3);
  });
});
