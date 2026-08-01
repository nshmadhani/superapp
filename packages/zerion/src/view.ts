import { resolveTokenIcon } from "./icons";
import type { PortfolioPosition } from "./portfolio";

export type PortfolioLeg = {
  symbol: string;
  name: string;
  quantity: string;
  valueUsd: number | null;
  chainId: string;
  address: string | null;
  iconUrl: string | null;
  walletId?: string;
  walletLabel?: string;
  walletAddress?: string;
  kind: "wallet" | "defi";
  protocol?: string | null;
  positionType?: string | null;
};

export type TokenGroup = {
  symbol: string;
  name: string;
  iconUrl: string | null;
  quantity: string;
  valueUsd: number;
  chainCount: number;
  legs: PortfolioLeg[];
};

export type ProtocolGroup = {
  protocol: string;
  valueUsd: number;
  legs: PortfolioLeg[];
};

export type VenueId = "hyperliquid" | "polymarket";

export type VenueSummary = {
  id: VenueId;
  status: "ready" | "empty" | "error";
  valueUsd: number;
  error?: string;
};

export type VenuePositionRow = {
  venue: VenueId;
  title: string;
  subtitle?: string;
  valueUsd: number;
  pnlUsd?: number | null;
  quantity?: string;
  iconUrl?: string | null;
  walletId?: string;
  walletLabel?: string;
  walletAddress?: string;
};

export type VenuePositions = {
  venues: VenueSummary[];
  positions: VenuePositionRow[];
  valueUsd: number;
};

/** @deprecated Prefer VenuePositions — kept for older call sites. */
export type VenueStub = VenuePositions;

export type PortfolioWalletRow = {
  walletId: string;
  address: string;
  label?: string;
  chainFamily: "evm" | "solana";
  source: string;
  totalValueUsd: number;
  positions: PortfolioPosition[];
  error?: string;
};

export type PortfolioView = {
  totalValueUsd: number;
  tokensValueUsd: number;
  defiValueUsd: number;
  positionsValueUsd: number;
  asOf: string;
  tokens: TokenGroup[];
  positions: VenuePositions;
  defi: ProtocolGroup[];
  wallets: PortfolioWalletRow[];
};

const EMPTY_VENUES: VenuePositions = {
  venues: [
    { id: "hyperliquid", status: "empty", valueUsd: 0 },
    { id: "polymarket", status: "empty", valueUsd: 0 },
  ],
  positions: [],
  valueUsd: 0,
};

function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return n.toPrecision(6);
  if (Math.abs(n) >= 1) return String(Number(n.toFixed(6)));
  return String(Number(n.toPrecision(6)));
}

function toLeg(
  p: PortfolioPosition & {
    walletId?: string;
    walletLabel?: string;
    walletAddress?: string;
  },
): PortfolioLeg {
  const kind = p.kind === "defi" ? "defi" : "wallet";
  const iconUrl = resolveTokenIcon({
    iconUrl: p.iconUrl,
    chainId: p.chainId,
    address: p.address,
  });
  return {
    symbol: p.symbol,
    name: p.name,
    quantity: p.quantity,
    valueUsd: p.valueUsd,
    chainId: p.chainId,
    address: p.address,
    iconUrl,
    walletId: p.walletId,
    walletLabel: p.walletLabel,
    walletAddress: p.walletAddress,
    kind,
    protocol: p.protocol ?? null,
    positionType: p.positionType ?? null,
  };
}

/**
 * Shape flat Zerion legs into Tokens (by symbol) / Positions / DeFi (by protocol).
 */
export function buildPortfolioView(opts: {
  legs: Array<
    PortfolioPosition & {
      walletId?: string;
      walletLabel?: string;
      walletAddress?: string;
    }
  >;
  wallets?: PortfolioWalletRow[];
  asOf?: string;
  venuePositions?: VenuePositions;
}): PortfolioView {
  const legs = opts.legs.map(toLeg);
  const tokenLegs = legs.filter((l) => l.kind === "wallet");
  const defiLegs = legs.filter((l) => l.kind === "defi");

  const tokenMap = new Map<string, PortfolioLeg[]>();
  for (const leg of tokenLegs) {
    const key = leg.symbol.toUpperCase();
    const list = tokenMap.get(key) ?? [];
    list.push(leg);
    tokenMap.set(key, list);
  }

  const tokens: TokenGroup[] = [...tokenMap.entries()].map(([, groupLegs]) => {
    groupLegs.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
    const valueUsd = groupLegs.reduce((s, l) => s + (l.valueUsd ?? 0), 0);
    const qtySum = groupLegs.reduce(
      (s, l) => s + (Number.parseFloat(l.quantity) || 0),
      0,
    );
    const chains = new Set(groupLegs.map((l) => l.chainId));
    const primary = groupLegs[0]!;
    return {
      symbol: primary.symbol,
      name: primary.name,
      iconUrl: primary.iconUrl,
      quantity: formatQty(qtySum),
      valueUsd,
      chainCount: chains.size,
      legs: groupLegs,
    };
  });
  tokens.sort((a, b) => b.valueUsd - a.valueUsd);

  const protocolMap = new Map<string, PortfolioLeg[]>();
  for (const leg of defiLegs) {
    const key = leg.protocol?.trim() || "DeFi";
    const list = protocolMap.get(key) ?? [];
    list.push(leg);
    protocolMap.set(key, list);
  }

  const defi: ProtocolGroup[] = [...protocolMap.entries()].map(
    ([protocol, groupLegs]) => {
      groupLegs.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
      return {
        protocol,
        valueUsd: groupLegs.reduce((s, l) => s + (l.valueUsd ?? 0), 0),
        legs: groupLegs,
      };
    },
  );
  defi.sort((a, b) => b.valueUsd - a.valueUsd);

  const tokensValueUsd = tokens.reduce((s, t) => s + t.valueUsd, 0);
  const defiValueUsd = defi.reduce((s, d) => s + d.valueUsd, 0);
  const positions = opts.venuePositions ?? EMPTY_VENUES;
  const positionsValueUsd = positions.valueUsd;

  return {
    totalValueUsd: tokensValueUsd + defiValueUsd + positionsValueUsd,
    tokensValueUsd,
    defiValueUsd,
    positionsValueUsd,
    asOf: opts.asOf ?? new Date().toISOString(),
    tokens,
    positions,
    defi,
    wallets: opts.wallets ?? [],
  };
}
