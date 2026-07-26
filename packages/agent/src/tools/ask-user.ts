import { tool } from "ai";
import { z } from "zod";

export function askUserTool() {
  return tool({
    description:
      "Ask the user a clarification with concrete options when possible (which linked wallet, how much of a known balance, etc.). Prefer options from list_wallets / get_portfolio — e.g. EVM wallet labels as HyperEVM destinations. The UI surfaces this.",
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
