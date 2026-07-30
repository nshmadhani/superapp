import { webSearch, type SearchHit } from "@ervo/search";
import { e2bConfigured, parseJsonFromE2bText, runInE2b } from "../e2b";
import type { GeneralArtifact } from "../types";

/** Break a long research goal into a few focused Tavily queries. */
export function researchQueries(goal: string, max = 4): string[] {
  const queries: string[] = [];
  const numbered = [
    ...goal.matchAll(
      /(?:^|\n)\s*(?:\d+[\).]|[-*])\s*\*?\*?([^\n*]{8,120})/g,
    ),
  ];
  for (const m of numbered) {
    const q = m[1]!.replace(/\s+/g, " ").trim();
    if (q.length >= 8) queries.push(q.slice(0, 140));
    if (queries.length >= max) break;
  }
  if (queries.length === 0) {
    queries.push(goal.replace(/\s+/g, " ").trim().slice(0, 160));
  }
  // Always include a short keyword query from the first line / title-ish.
  const head = goal.split("\n").map((l) => l.trim()).find((l) => l.length > 12);
  if (head) {
    const short = head.replace(/[*#]/g, "").slice(0, 100);
    if (!queries.some((q) => q.includes(short.slice(0, 40)))) {
      queries.unshift(short);
    }
  }
  return [...new Set(queries)].slice(0, max);
}

async function searchMany(goal: string): Promise<SearchHit[]> {
  const queries = researchQueries(goal);
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
      // try next query
    }
  }
  return hits;
}

export async function runGeneralJob(
  goal: string,
  _policy: Record<string, unknown>,
): Promise<{
  artifact: GeneralArtifact;
  source: "live" | "fallback";
  sandboxId?: string;
}> {
  const hits = await searchMany(goal);

  if (!hits.length && !e2bConfigured()) {
    return {
      artifact: {
        kind: "general",
        summary: `Could not gather live sources for: ${goal.slice(0, 200)}`,
        bullets: [
          "Web search returned no results and E2B is not configured.",
          "Retry later or refine the goal with named projects / URLs.",
        ],
      },
      source: "fallback",
    };
  }

  // Prefer a real brief from search hits even when E2B is down.
  if (!e2bConfigured()) {
    return { artifact: summarizeLocally(goal, hits), source: "live" };
  }

  const code = `
import json
goal = ${JSON.stringify(goal.slice(0, 2500))}
hits = ${JSON.stringify(
    hits.slice(0, 8).map((h) => ({
      title: h.title,
      url: h.url,
      content: h.content.slice(0, 400),
    })),
  )}
bullets = []
for h in hits[:5]:
    snippet = (h.get("content") or "")[:220].replace("\\n", " ")
    bullets.append(f"{h.get('title')}: {snippet}")
if not bullets:
    bullets = ["No web hits; sandbox acknowledged the goal only."]
citations = [{"title": h.get("title") or h.get("url"), "url": h.get("url")} for h in hits if h.get("url")]
summary = (
    f"Research brief from {len(hits)} sources. Goal: " + goal[:280]
    if hits else f"Autonomous brief for: {goal[:280]}"
)
out = {
  "kind": "general",
  "summary": summary,
  "bullets": bullets,
  "citations": citations,
}
print(json.dumps(out))
`;

  try {
    const exec = await runInE2b(code);
    const artifact = parseJsonFromE2bText<GeneralArtifact>(exec.text);
    if (artifact.kind !== "general") throw new Error("bad_artifact");
    if (!artifact.citations?.length && hits.length) {
      artifact.citations = hits.map((h) => ({
        title: h.title || h.url,
        url: h.url,
      }));
    }
    if ((!artifact.bullets || artifact.bullets.length === 0) && hits.length) {
      return {
        artifact: summarizeLocally(goal, hits),
        source: "live",
        sandboxId: exec.sandboxId,
      };
    }
    return { artifact, source: "live", sandboxId: exec.sandboxId };
  } catch {
    if (hits.length) {
      return { artifact: summarizeLocally(goal, hits), source: "live" };
    }
    return {
      artifact: {
        kind: "general",
        summary: `Could not complete research for: ${goal.slice(0, 200)}`,
        bullets: [
          "E2B summarization failed and web search returned no usable hits.",
          "Retry with a shorter goal or named sources.",
        ],
      },
      source: "fallback",
    };
  }
}

function summarizeLocally(goal: string, hits: SearchHit[]): GeneralArtifact {
  return {
    kind: "general",
    summary: `Research brief from ${hits.length} sources. Goal: ${goal.slice(0, 280)}`,
    bullets: hits.slice(0, 6).map((h) => {
      const snippet = h.content.slice(0, 220).replace(/\s+/g, " ");
      return `${h.title}: ${snippet}`;
    }),
    citations: hits.map((h) => ({ title: h.title || h.url, url: h.url })),
  };
}
