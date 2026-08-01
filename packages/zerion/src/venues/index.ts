import { fetchHyperliquidSnapshot } from "./hyperliquid";
import { fetchPolymarketSnapshot } from "./polymarket";
import type {
  VenueId,
  VenuePositionRow,
  VenuePositions,
  VenueSummary,
} from "../view";

function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return n.toPrecision(6);
  if (Math.abs(n) >= 1) return String(Number(n.toFixed(6)));
  return String(Number(n.toPrecision(6)));
}

type WalletRef = {
  address: string;
  walletId?: string;
  walletLabel?: string;
  chainFamily: "evm" | "solana";
};

async function forVenue(
  id: VenueId,
  wallets: WalletRef[],
  fetchOne: (address: string) => Promise<{
    valueUsd: number;
    rows: VenuePositionRow[];
  }>,
): Promise<{ summary: VenueSummary; rows: VenuePositionRow[] }> {
  const evm = wallets.filter((w) => w.chainFamily === "evm");
  if (evm.length === 0) {
    return {
      summary: { id, status: "empty", valueUsd: 0 },
      rows: [],
    };
  }

  let valueUsd = 0;
  const rows: VenuePositionRow[] = [];
  const errors: string[] = [];

  for (const w of evm) {
    try {
      const snap = await fetchOne(w.address);
      valueUsd += snap.valueUsd;
      for (const row of snap.rows) {
        rows.push({
          ...row,
          walletId: w.walletId,
          walletLabel: w.walletLabel,
          walletAddress: w.address,
        });
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `${id}_failed`);
    }
  }

  if (errors.length === evm.length) {
    return {
      summary: {
        id,
        status: "error",
        valueUsd: 0,
        error: errors[0],
      },
      rows: [],
    };
  }

  rows.sort((a, b) => b.valueUsd - a.valueUsd);
  return {
    summary: {
      id,
      status: valueUsd > 0 || rows.length > 0 ? "ready" : "empty",
      valueUsd,
      error: errors[0],
    },
    rows,
  };
}

/** Read-only Hyperliquid + Polymarket balances for linked wallet addresses. */
export async function fetchVenuePositions(
  wallets: WalletRef[],
): Promise<VenuePositions> {
  const [hl, poly] = await Promise.all([
    forVenue("hyperliquid", wallets, async (address) => {
      const snap = await fetchHyperliquidSnapshot(address);
      const rows: VenuePositionRow[] = snap.positions.map((p) => {
        const side = p.size >= 0 ? "Long" : "Short";
        const entry =
          p.entryPx != null ? ` @ ${formatQty(p.entryPx)}` : "";
        return {
          venue: "hyperliquid" as const,
          title: `${p.coin} perp`,
          subtitle: `${side} ${formatQty(Math.abs(p.size))}${entry}`,
          valueUsd: Math.abs(p.positionValueUsd),
          pnlUsd: p.unrealizedPnlUsd,
          quantity: formatQty(p.size),
          iconUrl: null,
        };
      });
      // Account equity when flat or larger than open notional sleeves.
      if (snap.accountValueUsd > 0 && rows.length === 0) {
        rows.push({
          venue: "hyperliquid",
          title: "Account equity",
          subtitle:
            snap.withdrawableUsd > 0
              ? `Withdrawable ${formatQty(snap.withdrawableUsd)}`
              : undefined,
          valueUsd: snap.accountValueUsd,
          pnlUsd: null,
          quantity: undefined,
          iconUrl: null,
        });
      }
      return { valueUsd: snap.accountValueUsd, rows };
    }),
    forVenue("polymarket", wallets, async (address) => {
      const snap = await fetchPolymarketSnapshot(address);
      const rows: VenuePositionRow[] = snap.positions.map((p) => ({
        venue: "polymarket" as const,
        title: p.title,
        subtitle: p.outcome
          ? `${p.outcome}${p.curPrice != null ? ` · ${formatQty(p.curPrice)}` : ""}`
          : undefined,
        valueUsd: p.currentValueUsd,
        pnlUsd: p.cashPnlUsd,
        quantity: formatQty(p.size),
        iconUrl: p.iconUrl,
      }));
      return { valueUsd: snap.valueUsd, rows };
    }),
  ]);

  const venues = [hl.summary, poly.summary];
  const positions = [...hl.rows, ...poly.rows].sort(
    (a, b) => b.valueUsd - a.valueUsd,
  );
  const valueUsd = venues.reduce((s, v) => s + v.valueUsd, 0);

  return { venues, positions, valueUsd };
}

export { fetchHyperliquidSnapshot } from "./hyperliquid";
export { fetchPolymarketSnapshot } from "./polymarket";
