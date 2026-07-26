import { describe, it, expect } from "vitest";
import { getQuickNodeHttpUrl } from "./evm";

describe("getQuickNodeHttpUrl", () => {
  it("maps ethereum mainnet", () => {
    expect(getQuickNodeHttpUrl(1, "aged-alien-frog", "TOKEN")).toBe(
      "https://aged-alien-frog.ethereum-mainnet.quiknode.pro/TOKEN",
    );
  });

  it("maps base", () => {
    expect(getQuickNodeHttpUrl(8453, "aged-alien-frog", "TOKEN")).toBe(
      "https://aged-alien-frog.base-mainnet.quiknode.pro/TOKEN",
    );
  });

  it("rejects unsupported chains", () => {
    expect(() => getQuickNodeHttpUrl(999, "x", "TOKEN")).toThrow(/Unsupported/);
  });
});
