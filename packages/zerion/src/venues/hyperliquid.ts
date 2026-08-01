const HL_INFO_URL = "https://api.hyperliquid.xyz/info";

export type HlVenueSnapshot = {
  accountValueUsd: number;
  withdrawableUsd: number;
  positions: Array<{
    coin: string;
    size: number;
    entryPx: number | null;
    positionValueUsd: number;
    unrealizedPnlUsd: number;
    leverage: number | null;
  }>;
};

type ClearinghouseState = {
  marginSummary?: { accountValue?: string };
  withdrawable?: string;
  assetPositions?: Array<{
    position?: {
      coin?: string;
      szi?: string;
      entryPx?: string;
      positionValue?: string;
      unrealizedPnl?: string;
      leverage?: { value?: number };
    };
  }>;
};

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

async function postInfo(body: unknown): Promise<unknown> {
  const res = await fetch(HL_INFO_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Hyperliquid ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}`,
    );
  }
  return res.json();
}

/** Read-only perp account + open positions for an EVM address. */
export async function fetchHyperliquidSnapshot(
  address: string,
): Promise<HlVenueSnapshot> {
  const user = address.toLowerCase();
  const raw = (await postInfo({
    type: "clearinghouseState",
    user,
  })) as ClearinghouseState;

  const positions = (raw.assetPositions ?? [])
    .map((row) => {
      const p = row.position;
      if (!p?.coin) return null;
      const size = num(p.szi);
      if (size === 0) return null;
      return {
        coin: p.coin,
        size,
        entryPx: p.entryPx != null ? num(p.entryPx) : null,
        positionValueUsd: num(p.positionValue),
        unrealizedPnlUsd: num(p.unrealizedPnl),
        leverage: p.leverage?.value ?? null,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p != null);

  return {
    accountValueUsd: num(raw.marginSummary?.accountValue),
    withdrawableUsd: num(raw.withdrawable),
    positions,
  };
}
