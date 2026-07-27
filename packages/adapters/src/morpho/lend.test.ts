import { describe, expect, it } from "vitest";
import { quoteMorphoLend } from "./lend";

describe("quoteMorphoLend", () => {
  it("builds approve + deposit txs for Base USDC vault", async () => {
    const q = await quoteMorphoLend({
      chainId: 8453,
      fromAddress: "0x1111111111111111111111111111111111111111",
      amount: "1000000",
      vaultAddress: "0xeE8F4eC5672F09119b96Ab6fB59C27E1b7e44b61",
    });
    expect(q.adapterId).toBe("morpho");
    expect(q.approveTx.to.toLowerCase()).toBe(
      "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    );
    expect(q.depositTx.to.toLowerCase()).toBe(
      "0xee8f4ec5672f09119b96ab6fb59c27e1b7e44b61",
    );
    expect(q.approveTx.data.startsWith("0x")).toBe(true);
    expect(q.depositTx.data.startsWith("0x")).toBe(true);
    expect(q.displayRoute).toMatch(/Morpho/);
  });
});
