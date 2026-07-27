import { describe, it, expect } from "vitest";
import {
  isAddressSignable,
  normalizeSignableAddress,
  toSignableSet,
} from "./signable";

describe("signable helpers", () => {
  it("normalizes EVM case", () => {
    expect(normalizeSignableAddress("0xAbC")).toBe("0xabc");
  });

  it("marks only live addresses signable", () => {
    const set = toSignableSet(["0xAAA", "7gnmUYGyQx7WsF26JeQeis7k1KamaQTgwkx4bFYbhK1p"]);
    expect(isAddressSignable(set, "0xaaa")).toBe(true);
    expect(isAddressSignable(set, "0xbbb")).toBe(false);
    expect(
      isAddressSignable(set, "7gnmUYGyQx7WsF26JeQeis7k1KamaQTgwkx4bFYbhK1p"),
    ).toBe(true);
  });

  it("returns null when live set unknown", () => {
    expect(isAddressSignable(null, "0xaaa")).toBe(null);
  });
});
