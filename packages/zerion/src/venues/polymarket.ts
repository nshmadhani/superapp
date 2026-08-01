const POLY_DATA_URL = "https://data-api.polymarket.com";

export type PolyVenueSnapshot = {
  valueUsd: number;
  positions: Array<{
    title: string;
    outcome: string;
    size: number;
    currentValueUsd: number;
    cashPnlUsd: number;
    curPrice: number | null;
    iconUrl: string | null;
    slug: string | null;
  }>;
};

type PolyPosition = {
  title?: string;
  outcome?: string;
  size?: number;
  currentValue?: number;
  cashPnl?: number;
  curPrice?: number;
  icon?: string;
  slug?: string;
};

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Read-only Polymarket positions + portfolio value for a wallet/proxy address. */
export async function fetchPolymarketSnapshot(
  address: string,
): Promise<PolyVenueSnapshot> {
  const user = address.toLowerCase();
  const positionsUrl = new URL(`${POLY_DATA_URL}/positions`);
  positionsUrl.searchParams.set("user", user);
  positionsUrl.searchParams.set("sizeThreshold", "0");
  positionsUrl.searchParams.set("limit", "100");
  positionsUrl.searchParams.set("sortBy", "CURRENT");
  positionsUrl.searchParams.set("sortDirection", "DESC");

  const valueUrl = new URL(`${POLY_DATA_URL}/value`);
  valueUrl.searchParams.set("user", user);

  const [posRes, valueRes] = await Promise.all([
    fetch(positionsUrl),
    fetch(valueUrl),
  ]);

  if (!posRes.ok) {
    const text = await posRes.text().catch(() => "");
    throw new Error(
      `Polymarket positions ${posRes.status}${text ? `: ${text.slice(0, 160)}` : ""}`,
    );
  }

  const rawPositions = (await posRes.json()) as PolyPosition[];
  const positions = (Array.isArray(rawPositions) ? rawPositions : [])
    .map((p) => ({
      title: p.title?.trim() || "Market",
      outcome: p.outcome?.trim() || "",
      size: num(p.size),
      currentValueUsd: num(p.currentValue),
      cashPnlUsd: num(p.cashPnl),
      curPrice: typeof p.curPrice === "number" ? p.curPrice : null,
      iconUrl: p.icon ?? null,
      slug: p.slug ?? null,
    }))
    .filter((p) => p.size !== 0 || p.currentValueUsd !== 0);

  let valueUsd = positions.reduce((s, p) => s + p.currentValueUsd, 0);
  if (valueRes.ok) {
    const valueBody = (await valueRes.json()) as
      | Array<{ value?: number }>
      | { value?: number };
    const reported = Array.isArray(valueBody)
      ? valueBody[0]?.value
      : valueBody.value;
    if (typeof reported === "number" && Number.isFinite(reported)) {
      valueUsd = reported;
    }
  }

  return { valueUsd, positions };
}
