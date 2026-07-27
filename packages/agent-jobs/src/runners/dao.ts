import { webSearch, type SearchHit } from "@cipher/search";
import { e2bConfigured, parseJsonFromE2bText, runInE2b } from "../e2b";
import { fallbackDao } from "../fallbacks";
import type { DaoArtifact } from "../types";
import { researchQueries } from "./general";

async function searchMany(topic: string): Promise<SearchHit[]> {
  const base = researchQueries(topic, 3);
  const queries = [
    ...base,
    `${topic.slice(0, 80)} DAO governance proposal`,
    `${topic.slice(0, 80)} Snapshot governance`,
  ].slice(0, 5);
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  for (const q of queries) {
    try {
      const batch = await webSearch(q);
      for (const h of batch) {
        const key = h.url || h.title;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        hits.push(h);
      }
    } catch {
      // next
    }
  }
  return hits;
}

export async function runDaoJob(
  goal: string,
  policy: Record<string, unknown>,
): Promise<{ artifact: DaoArtifact; source: "live" | "fallback"; sandboxId?: string }> {
  const topic = String(policy.topic ?? goal);

  const hits = await searchMany(topic);

  if (!hits.length) {
    return { artifact: fallbackDao(topic.slice(0, 200)), source: "fallback" };
  }

  if (!e2bConfigured()) {
    return {
      artifact: summarizeLocally(topic, hits),
      source: "live",
    };
  }

  const code = `
import json
topic = ${JSON.stringify(topic.slice(0, 1500))}
hits = ${JSON.stringify(
    hits.slice(0, 8).map((h) => ({
      title: h.title,
      url: h.url,
      content: h.content.slice(0, 400),
    })),
  )}
bullets = []
for h in hits[:4]:
    snippet = (h.get("content") or "")[:200].replace("\\n", " ")
    bullets.append(f"{h.get('title')}: {snippet}")
summary = f"Research brief for {topic[:200]} from {len(hits)} public sources."
out = {
    "kind": "dao_research",
    "topic": topic[:240],
    "summary": summary,
    "bullets": bullets,
    "citations": [{"title": h.get("title") or h.get("url"), "url": h.get("url")} for h in hits if h.get("url")],
}
print(json.dumps(out))
`;

  try {
    const exec = await runInE2b(code);
    const artifact = parseJsonFromE2bText<DaoArtifact>(exec.text);
    if (artifact.kind !== "dao_research") throw new Error("bad_artifact");
    if (!artifact.citations?.length) {
      artifact.citations = hits.map((h) => ({
        title: h.title || h.url,
        url: h.url,
      }));
    }
    return { artifact, source: "live", sandboxId: exec.sandboxId };
  } catch {
    return { artifact: summarizeLocally(topic, hits), source: "live" };
  }
}

function summarizeLocally(topic: string, hits: SearchHit[]): DaoArtifact {
  return {
    kind: "dao_research",
    topic: topic.slice(0, 240),
    summary: `Research brief for ${topic.slice(0, 200)} from ${hits.length} public sources.`,
    bullets: hits.slice(0, 5).map((h) => {
      const snippet = h.content.slice(0, 200).replace(/\s+/g, " ");
      return `${h.title}: ${snippet}`;
    }),
    citations: hits.map((h) => ({ title: h.title || h.url, url: h.url })),
  };
}
