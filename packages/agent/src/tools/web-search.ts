import { tool } from "ai";
import { z } from "zod";
import { webSearch } from "@ervo/search";

export function webSearchTool() {
  return tool({
    description:
      "Search the open web for crypto protocol news, docs, and status. Returns titled citations.",
    inputSchema: z.object({
      query: z.string().describe("Search query"),
    }),
    execute: async ({ query }) => {
      try {
        return { results: await webSearch(query) };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "search_failed",
        };
      }
    },
  });
}
