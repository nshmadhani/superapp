import { webSearch } from "@cipher/search";
import { e2bConfigured, parseJsonFromE2bText, runInE2b } from "../e2b";
import type { GeneralArtifact } from "../types";

export async function runGeneralJob(
  goal: string,
  _policy: Record<string, unknown>,
): Promise<{
  artifact: GeneralArtifact;
  source: "live" | "fallback";
  sandboxId?: string;
}> {
  let hits: Array<{ title: string; url: string; content: string }> = [];
  try {
    hits = await webSearch(goal);
  } catch {
    // continue
  }

  if (!hits.length && !e2bConfigured()) {
    return {
      artifact: {
        kind: "general",
        summary: `Could not gather live sources for: ${goal}`,
        bullets: [
          "Retry later or refine the goal.",
          "Long-running agents work best with a concrete deliverable.",
        ],
      },
      source: "fallback",
    };
  }

  if (!e2bConfigured()) {
    return { artifact: summarizeLocally(goal, hits), source: "live" };
  }

  const code = `
import json
goal = ${JSON.stringify(goal)}
hits = ${JSON.stringify(hits.slice(0, 6))}
bullets = []
for h in hits[:4]:
    snippet = (h.get("content") or "")[:200].replace("\\n", " ")
    bullets.append(f"{h.get('title')}: {snippet}")
if not bullets:
    bullets = ["No web hits; sandbox acknowledged the goal only."]
summary = f"Autonomous brief for: {goal}"
out = {
  "kind": "general",
  "summary": summary,
  "bullets": bullets,
  "citations": [{"title": h.get("title") or h.get("url"), "url": h.get("url")} for h in hits],
}
print(json.dumps(out))
`;

  try {
    const exec = await runInE2b(code);
    const artifact = parseJsonFromE2bText<GeneralArtifact>(exec.text);
    if (artifact.kind !== "general") throw new Error("bad_artifact");
    return { artifact, source: "live", sandboxId: exec.sandboxId };
  } catch {
    return {
      artifact: hits.length
        ? summarizeLocally(goal, hits)
        : {
            kind: "general",
            summary: `Sandbox failed; placeholder for: ${goal}`,
            bullets: ["E2B unavailable or parse failed."],
          },
      source: hits.length ? "live" : "fallback",
    };
  }
}

function summarizeLocally(
  goal: string,
  hits: Array<{ title: string; url: string; content: string }>,
): GeneralArtifact {
  return {
    kind: "general",
    summary: `Brief for: ${goal}`,
    bullets: hits.slice(0, 4).map((h) => {
      const snippet = h.content.slice(0, 180).replace(/\s+/g, " ");
      return `${h.title}: ${snippet}`;
    }),
    citations: hits.map((h) => ({ title: h.title || h.url, url: h.url })),
  };
}
