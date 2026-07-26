import { tool } from "ai";
import { z } from "zod";

export function askUserTool() {
  return tool({
    description:
      "Ask the user a clarification question (which wallet, native vs wrapped, etc.). The UI will surface this.",
    inputSchema: z.object({
      question: z.string(),
      options: z.array(z.string()).optional(),
    }),
    execute: async ({ question, options }) => ({
      type: "clarification" as const,
      question,
      options: options ?? [],
    }),
  });
}
