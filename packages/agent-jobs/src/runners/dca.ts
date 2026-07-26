import { e2bConfigured, parseJsonFromE2bText, runInE2b } from "../e2b";
import { fallbackDca } from "../fallbacks";
import type { DcaArtifact } from "../types";

export async function runDcaJob(
  goal: string,
  policy: Record<string, unknown>,
): Promise<{ artifact: DcaArtifact; source: "live" | "fallback"; sandboxId?: string }> {
  const asset = String(policy.asset ?? inferAsset(goal) ?? "ETH");
  const amountUsd = Number(policy.amountUsd ?? inferAmount(goal) ?? 50);
  const cadence = String(policy.cadence ?? inferCadence(goal) ?? "weekly");

  if (!e2bConfigured()) {
    return {
      artifact: fallbackDca(goal, { asset, amountUsd, cadence }),
      source: "fallback",
    };
  }

  const code = `
import json
from datetime import date, timedelta

asset = ${JSON.stringify(asset)}
amount = float(${amountUsd})
cadence = ${JSON.stringify(cadence)}
goal = ${JSON.stringify(goal)}
step = 1 if cadence == "daily" else 7
start = date.today()
legs = []
for i in range(4):
    d = start + timedelta(days=i * step)
    legs.append({"date": d.isoformat(), "amountUsd": amount})
out = {
  "kind": "dca",
  "asset": asset,
  "amountUsd": amount,
  "cadence": cadence,
  "nextRunAt": legs[0]["date"],
  "legs": legs,
  "summary": f"Autonomous DCA configured: {amount} USD of {asset} {cadence}. Goal: {goal}",
}
print(json.dumps(out))
`;

  try {
    const exec = await runInE2b(code);
    const artifact = parseJsonFromE2bText<DcaArtifact>(exec.text);
    if (artifact.kind !== "dca") throw new Error("bad_artifact");
    return { artifact, source: "live", sandboxId: exec.sandboxId };
  } catch {
    return {
      artifact: fallbackDca(goal, { asset, amountUsd, cadence }),
      source: "fallback",
    };
  }
}

function inferAsset(goal: string): string | null {
  const m = goal.match(/\b(ETH|BTC|SOL|USDC|WETH|LINK|UNI|AAVE)\b/i);
  return m ? m[1]!.toUpperCase() : null;
}

function inferAmount(goal: string): number | null {
  const m = goal.match(/\$?\s*(\d+(?:\.\d+)?)\s*(usd|dollars?)?/i);
  return m ? Number(m[1]) : null;
}

function inferCadence(goal: string): string | null {
  if (/daily/i.test(goal)) return "daily";
  if (/weekly/i.test(goal)) return "weekly";
  if (/monthly/i.test(goal)) return "monthly";
  return null;
}
