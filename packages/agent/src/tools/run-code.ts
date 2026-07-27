import { tool } from "ai";
import { z } from "zod";
import { e2bConfigured, runInE2b } from "@cipher/agent-jobs";

/**
 * Short inline code execution for chat (not a long-running agent).
 */
export function runCodeTool() {
  return tool({
    description:
      "Run a short Python snippet in a sandbox for analysis (TA math, transforms, quick computations). Prefer this over spawn_agent for one-shot questions. Keep code self-contained; print the final answer.",
    inputSchema: z.object({
      code: z.string().min(1).describe("Python code to execute; print the result"),
      purpose: z
        .string()
        .optional()
        .describe("One-line why this code is running (for the UI)"),
    }),
    execute: async ({ code, purpose }) => {
      if (!e2bConfigured()) {
        return {
          error: "e2b_unavailable",
          message:
            "Code sandbox not configured (E2B_API_KEY). Use web_search or reason without code.",
          purpose,
        };
      }
      try {
        const exec = await runInE2b(code);
        return {
          text: exec.text,
          stdout: exec.logs.stdout,
          stderr: exec.logs.stderr,
          sandboxId: exec.sandboxId,
          purpose,
        };
      } catch (err) {
        return {
          error: "run_code_failed",
          message: err instanceof Error ? err.message : "run_code_failed",
          purpose,
        };
      }
    },
  });
}
