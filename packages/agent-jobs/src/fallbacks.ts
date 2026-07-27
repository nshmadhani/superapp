import type { DaoArtifact, DcaArtifact } from "./types";

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
    walletAddress: undefined,
    walletLabel: undefined,
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
