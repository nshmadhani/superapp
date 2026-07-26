import { tool } from "ai";
import { z } from "zod";
import { createAndStartAgentRun } from "@cipher/agent-jobs";
import type { AgentContext } from "./index";

export function spawnAgentTool(ctx: AgentContext) {
  return tool({
    description:
      "Spawn a one-shot autonomous agent job (DCA, technical analysis, or DAO research). Returns a run id and Agents URL. Use when the user wants something that should run without a chat back-and-forth.",
    inputSchema: z.object({
      type: z.enum(["dca", "ta", "dao_research"]),
      goal: z.string().min(3).describe("What the autonomous agent should accomplish"),
      policy: z
        .record(z.unknown())
        .optional()
        .describe(
          "Type-specific knobs, e.g. {asset, amountUsd, cadence} for dca; {symbol, interval} for ta; {topic} for dao_research",
        ),
    }),
    execute: async ({ type, goal, policy }) => {
      const run = createAndStartAgentRun({
        userId: ctx.userId,
        type,
        goal,
        policy: policy ?? {},
      });
      return {
        runId: run.id,
        type: run.type,
        status: run.status,
        href: `/agents/${run.id}`,
        message: `Autonomous agent started. Open Agents to watch it: /agents/${run.id}`,
      };
    },
  });
}
