import { AuthError, requireAuthUserId } from "@/lib/auth";
import { store } from "@cipher/agent";
import { fetchAggregatedPortfolio, fetchPortfolio } from "@cipher/zerion";

function addressesMatch(a: string, b: string): boolean {
  if (a.startsWith("0x") || b.startsWith("0x")) {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}

export async function GET(req: Request) {
  try {
    const userId = await requireAuthUserId();
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope");
    const address = searchParams.get("address");

    const wallets = await store.listWallets(userId);

    if (scope === "all" || (!address && scope !== "wallet")) {
      if (wallets.length === 0) {
        return Response.json({
          totalValueUsd: 0,
          asOf: new Date().toISOString(),
          wallets: [],
          positions: [],
        });
      }
      const aggregated = await fetchAggregatedPortfolio(wallets);
      return Response.json(aggregated);
    }

    if (!address) {
      return Response.json({ error: "address_required" }, { status: 400 });
    }

    const owned = wallets.find((w) => addressesMatch(w.address, address));
    if (!owned) {
      return Response.json({ error: "address_not_owned" }, { status: 403 });
    }

    const snapshot = await fetchPortfolio(owned.address);
    return Response.json({
      ...snapshot,
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
