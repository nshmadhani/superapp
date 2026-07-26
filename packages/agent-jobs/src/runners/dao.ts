import { webSearch } from "@cipher/search";
import { e2bConfigured, parseJsonFromE2bText, runInE2b } from "../e2b";
import { fallbackDao } from "../fallbacks";
import type { DaoArtifact } from "../types";

export async function runDaoJob(
  goal: string,
  policy: Record<string, unknown>,
): Promise<{ artifact: DaoArtifact; source: "live" | "fallback"; sandboxId?: string }> {
  const topic = String(policy.topic ?? goal);

  let hits: Array<{ title: string; url: string; content: string }> = [];
  try {
    hits = await webSearch(`${topic} DAO governance proposal`);
  } catch {
    // continue — may still fallback
  }

  if (!hits.length) {
    return { artifact: fallbackDao(topic), source: "fallback" };
  }

  if (!e2bConfigured()) {
    return {
      artifact: summarizeLocally(topic, hits),
      source: "live",
    };
  }

  const code = `
import json
topic = ${JSON.stringify(topic)}
hits = ${JSON.stringify(hits.slice(0, 5))}
bullets = []
for h in hits[:3]:
    snippet = (h.get("content") or "")[:180].replace("\\n", " ")
    bullets.append(f"{h.get('title')}: {snippet}")
summary = f"Research brief for {topic} from {len(hits)} public sources."
out = {
  "kind": "dao_research",
  "topic": topic,
  "summary": summary,
  "bullets": bullets,
  "citations": [{"title": h.get("title") or h.get("url"), "url": h.get("url")} for h in hits],
}
print(json.dumps(out))
`;

  try {
    const exec = await runInE2b(code);
    const artifact = parseJsonFromE2bText<DaoArtifact>(exec.text);
    if (artifact.kind !== "dao_research") throw new Error("bad_artifact");
    return { artifact, source: "live", sandboxId: exec.sandboxId };
  } catch {
    return { artifact: summarizeLocally(topic, hits), source: "live" };
  }
}

function summarizeLocally(
  topic: string,
  hits: Array<{ title: string; url: string; content: string }>,
): DaoArtifact {
  return {
    kind: "dao_research",
    topic,
    summary: `Research brief for ${topic} from ${hits.length} public sources.`,
    bullets: hits.slice(0, 3).map((h) => {
      const snippet = h.content.slice(0, 180).replace(/\s+/g, " ");
      return `${h.title}: ${snippet}`;
    }),
    citations: hits.map((h) => ({ title: h.title || h.url, url: h.url })),
  };
}
