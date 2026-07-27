import { describe, it, expect } from "vitest";
import { getQuickNodeHttpUrl, resolveEvmRpcUrl } from "./evm";

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

  it("maps HyperEVM with /evm suffix", () => {
    expect(getQuickNodeHttpUrl(999, "aged-alien-frog", "TOKEN")).toBe(
      "https://aged-alien-frog.hype-mainnet.quiknode.pro/TOKEN/evm",
    );
  });

  it("rejects unsupported chains", () => {
    expect(() => getQuickNodeHttpUrl(12345, "x", "TOKEN")).toThrow(
      /Unsupported/,
    );
  });
});

describe("resolveEvmRpcUrl", () => {
  it("prefers explicit HyperEVM override", () => {
    expect(
      resolveEvmRpcUrl(999, {
        HYPEREVM_RPC_URL:
          "https://aged-alien-frog.hype-mainnet.quiknode.pro/TOKEN/evm",
      }),
    ).toBe("https://aged-alien-frog.hype-mainnet.quiknode.pro/TOKEN/evm");
  });

  it("builds Base from QuickNode env", () => {
    expect(
      resolveEvmRpcUrl(8453, {
        QUICKNODE_ENDPOINT_NAME: "aged-alien-frog",
        QUICKNODE_API_TOKEN: "TOKEN",
      }),
    ).toBe(
      "https://aged-alien-frog.base-mainnet.quiknode.pro/TOKEN",
    );
  });
});
