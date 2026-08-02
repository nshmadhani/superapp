import { AuthError, requireAuthUserId } from "@/lib/auth";
import { store } from "@ervo/agent";
import {
  cachedPortfolioView,
  fetchAggregatedPortfolio,
  fetchPortfolio,
  portfolioAddressCacheKey,
  portfolioApiCacheKey,
  portfolioSnapshotToView,
  type PortfolioView,
} from "@ervo/zerion";

function addressesMatch(a: string, b: string): boolean {
  if (a.startsWith("0x") || b.startsWith("0x")) {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}

const EMPTY_VIEW: PortfolioView = {
  totalValueUsd: 0,
  tokensValueUsd: 0,
  defiValueUsd: 0,
  positionsValueUsd: 0,
  asOf: new Date().toISOString(),
  tokens: [],
  positions: {
    venues: [
      { id: "hyperliquid", status: "empty", valueUsd: 0 },
      { id: "polymarket", status: "empty", valueUsd: 0 },
    ],
    positions: [],
    valueUsd: 0,
  },
  defi: [],
  wallets: [],
};

export async function GET(req: Request) {
  try {
    const userId = await requireAuthUserId();
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope");
    const address = searchParams.get("address");
    const force =
      searchParams.get("refresh") === "1" ||
      searchParams.get("force") === "1";

    const wallets = await store.listWallets(userId);

    if (scope === "all" || (!address && scope !== "wallet")) {
      if (wallets.length === 0) {
        return Response.json({
          ...EMPTY_VIEW,
          asOf: new Date().toISOString(),
        } satisfies PortfolioView);
      }

      const view = await cachedPortfolioView(
        portfolioApiCacheKey(userId, "all"),
        () => fetchAggregatedPortfolio(wallets, { force }),
        { force, userId },
      );
      return Response.json(view);
    }

    if (!address) {
      return Response.json({ error: "address_required" }, { status: 400 });
    }

    const owned = wallets.find((w) => addressesMatch(w.address, address));
    if (!owned) {
      return Response.json({ error: "address_not_owned" }, { status: 403 });
    }

    const view = await cachedPortfolioView(
      portfolioAddressCacheKey(owned.address),
      async () => {
        const snapshot = await fetchPortfolio(owned.address, undefined, {
          force,
        });
        return portfolioSnapshotToView(snapshot, {
          walletId: owned.id,
          label: owned.label,
          chainFamily: owned.chainFamily,
          source: owned.source,
        });
      },
      { force, address: owned.address },
    );

    return Response.json({
      ...view,
      address: owned.address,
      walletId: owned.id,
      label: owned.label,
      chainFamily: owned.chainFamily,
      source: owned.source,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "portfolio_failed" },
      { status: 500 },
    );
  }
}
