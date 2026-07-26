import type { DaoArtifact, DcaArtifact, TaArtifact } from "./types";

export function fallbackDca(goal: string, policy: Record<string, unknown>): DcaArtifact {
  const asset = String(policy.asset ?? "ETH");
  const amountUsd = Number(policy.amountUsd ?? 50);
  const cadence = String(policy.cadence ?? "weekly");
  const start = new Date();
  const legs: DcaArtifact["legs"] = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * (cadence === "daily" ? 1 : 7));
    legs.push({ date: d.toISOString().slice(0, 10), amountUsd });
  }
  return {
    kind: "dca",
    asset,
    amountUsd,
    cadence,
    nextRunAt: legs[0]?.date ?? start.toISOString().slice(0, 10),
    legs,
    summary: `Fallback DCA: ${amountUsd} USD of ${asset} ${cadence}. Goal: ${goal}`,
  };
}

export function fallbackTa(symbol: string): TaArtifact {
  const now = Date.now();
  const series = Array.from({ length: 30 }, (_, i) => ({
    t: now - (29 - i) * 86_400_000,
    c: 100 + Math.sin(i / 4) * 8 + i * 0.3,
  }));
  const last = series[series.length - 1]?.c ?? 100;
  return {
    kind: "ta",
    symbol,
    interval: "1d",
    bias: "neutral",
    confidence: 0.4,
    summary: `Fallback TA for ${symbol}: insufficient live data; showing illustrative series. Bias neutral.`,
    indicators: { sma20: last * 0.98, sma50: last * 0.95, rsi14: 52, lastClose: last },
    series,
  };
}

export function fallbackDao(topic: string): DaoArtifact {
  return {
    kind: "dao_research",
    topic,
    summary: `Fallback research brief for “${topic}”. Live search/E2B unavailable; use this as a narrative placeholder for the YC demo.`,
    bullets: [
      "Governance activity should be verified on the official forum / Snapshot.",
      "Check treasury runway and recent proposal turnout before acting.",
      "Cross-check token unlocks and contributor grants in public docs.",
    ],
    citations: [
      {
        title: "Snapshot",
        url: "https://snapshot.org/",
      },
      {
        title: "DeepDAO",
        url: "https://deepdao.io/",
      },
    ],
  };
}
