import { tool } from "ai";
import { z } from "zod";
import {
  agentRunStore,
  createAgentRun,
  startAgentRun,
} from "@cipher/agent-jobs";
import { provisionAgentWallet } from "../provision-agent-wallet";
import { store } from "../store";
import type { AgentContext } from "./index";

export function spawnAgentTool(ctx: AgentContext) {
  return tool({
    description:
      "Spawn a one-shot autonomous agent job (DCA, technical analysis, or DAO research) with its own dedicated Turnkey wallet. Returns a run id, agent wallet address, and Agents URL. Use when the user wants something that should run without a chat back-and-forth.",
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
      const run = createAgentRun({
        userId: ctx.userId,
        type,
        goal,
        policy: policy ?? {},
        wallet: null,
      });

      let wallet;
      try {
        wallet = await provisionAgentWallet({
          userId: ctx.userId,
          type,
          runId: run.id,
        });
        agentRunStore.setWallet(run.id, wallet);
      } catch (err) {
        agentRunStore.update(run.id, {
          status: "failed",
          error:
            err instanceof Error
              ? err.message
              : "agent_wallet_provision_failed",
          finishedAt: new Date().toISOString(),
        });
        return {
          error: "agent_wallet_provision_failed",
          message:
            err instanceof Error ? err.message : "Could not create agent wallet",
          runId: run.id,
        };
      }

      // Ensure inventory has the wallet (provision already upserts).
      await store.listWallets(ctx.userId);

      startAgentRun(run.id);
      const started = agentRunStore.get(run.id)!;

      return {
        runId: started.id,
        type: started.type,
        status: started.status,
        href: `/agents/${started.id}`,
        wallet: started.wallet,
        message: `Autonomous agent started with dedicated wallet ${wallet.label} (${wallet.address}). Open Agents to watch it: /agents/${started.id}`,
      };
    },
  });
}
