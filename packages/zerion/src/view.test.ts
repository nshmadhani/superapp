import { describe, it, expect } from "vitest";
import { resolveTokenIcon, resolveChainIcon, resolveProtocolIcon } from "./icons";
import { buildPortfolioView } from "./view";
import type { PortfolioPosition } from "./portfolio";

describe("resolveTokenIcon", () => {
  it("prefers Zerion https icon URL", () => {
    expect(
      resolveTokenIcon({
        iconUrl: "https://cdn.zerion.io/eth.png",
        chainId: "ethereum",
        address: "0xabc",
      }),
    ).toBe("https://cdn.zerion.io/eth.png");
  });

  it("falls back to Trust Wallet asset path", () => {
    const url = resolveTokenIcon({
      iconUrl: null,
      chainId: "base",
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    });
    expect(url).toContain("blockchains/base/assets/");
    expect(url).toContain("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  });

  it("uses native logo when address missing", () => {
    expect(
      resolveTokenIcon({ iconUrl: null, chainId: "ethereum", address: null }),
    ).toBe(
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
    );
  });
});

describe("resolveChainIcon", () => {
  it("returns Trust Wallet chain logo for base", () => {
    expect(resolveChainIcon("base")).toBe(
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png",
    );
  });

  it("maps hyperevm to hyperliquid icon", () => {
    expect(resolveChainIcon("hyperevm")).toContain("hyperliquid");
  });
});

describe("resolveProtocolIcon", () => {
  it("resolves Morpho and Aave V3", () => {
    expect(resolveProtocolIcon("Morpho")).toContain("/morpho?");
    expect(resolveProtocolIcon("Aave V3")).toContain("aave-v3");
  });

  it("resolves venue stubs", () => {
    expect(resolveProtocolIcon("hyperliquid")).toContain("hyperliquid");
    expect(resolveProtocolIcon("Polymarket")).toContain("polymarket");
  });

  it("returns null for unknown protocols", () => {
    expect(resolveProtocolIcon("TotallyFakeProtocolXYZ")).toBeNull();
  });
});

describe("buildPortfolioView", () => {
  const usdcBase: PortfolioPosition = {
    symbol: "USDC",
    name: "USD Coin",
    quantity: "100",
    valueUsd: 100,
    chainId: "base",
    address: "0x8335",
    kind: "wallet",
    iconUrl: "https://cdn.zerion.io/usdc.png",
  };
  const usdcEth: PortfolioPosition = {
    symbol: "USDC",
    name: "USD Coin",
    quantity: "50",
    valueUsd: 50,
    chainId: "ethereum",
    address: "0xa0b8",
    kind: "wallet",
  };
  const eth: PortfolioPosition = {
    symbol: "ETH",
    name: "Ether",
    quantity: "1",
    valueUsd: 3000,
    chainId: "base",
    address: null,
    kind: "wallet",
  };
  const morpho: PortfolioPosition = {
    symbol: "USDC",
    name: "Morpho · Gauntlet",
    quantity: "40",
    valueUsd: 40,
    chainId: "base",
    address: "0x8335",
    kind: "defi",
    protocol: "Morpho",
    positionType: "deposit",
  };

  it("groups wallet tokens by symbol across chains", () => {
    const view = buildPortfolioView({
      legs: [
        { ...usdcBase, walletId: "1", walletAddress: "0x1" },
        { ...usdcEth, walletId: "1", walletAddress: "0x1" },
        { ...eth, walletId: "1", walletAddress: "0x1" },
      ],
    });
    expect(view.tokens).toHaveLength(2);
    const usdc = view.tokens.find((t) => t.symbol === "USDC");
    expect(usdc?.valueUsd).toBe(150);
    expect(usdc?.chainCount).toBe(2);
    expect(usdc?.legs).toHaveLength(2);
    expect(usdc?.iconUrl).toBe("https://cdn.zerion.io/usdc.png");
    expect(view.tokens[0]?.symbol).toBe("ETH");
    expect(view.defi).toHaveLength(0);
    expect(view.tokensValueUsd).toBe(3150);
  });

  it("excludes DeFi from tokens and groups by protocol", () => {
    const view = buildPortfolioView({
      legs: [usdcBase, morpho],
    });
    expect(view.tokens).toHaveLength(1);
    expect(view.tokens[0]?.valueUsd).toBe(100);
    expect(view.defi).toHaveLength(1);
    expect(view.defi[0]?.protocol).toBe("Morpho");
    expect(view.defi[0]?.valueUsd).toBe(40);
    expect(view.defiValueUsd).toBe(40);
    expect(view.totalValueUsd).toBe(140);
  });

  it("includes empty venue positions by default", () => {
    const view = buildPortfolioView({ legs: [] });
    expect(view.positions.valueUsd).toBe(0);
    expect(view.positions.venues.map((v) => v.id)).toEqual([
      "hyperliquid",
      "polymarket",
    ]);
    expect(view.tokens).toEqual([]);
    expect(view.totalValueUsd).toBe(0);
  });

  it("folds venue position value into totals", () => {
    const view = buildPortfolioView({
      legs: [usdcBase],
      venuePositions: {
        venues: [
          { id: "hyperliquid", status: "ready", valueUsd: 250 },
          { id: "polymarket", status: "empty", valueUsd: 0 },
        ],
        positions: [
          {
            venue: "hyperliquid",
            title: "ETH perp",
            valueUsd: 250,
            pnlUsd: 10,
          },
        ],
        valueUsd: 250,
      },
    });
    expect(view.positionsValueUsd).toBe(250);
    expect(view.totalValueUsd).toBe(350);
  });
});
