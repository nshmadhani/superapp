import { tool } from "ai";
import { z } from "zod";
import {
  agentRunStore,
  createAgentRun,
  createEphemeralAgentWallet,
  startAgentRun,
  toPublicAgentRun,
} from "@cipher/agent-jobs";
import { createDb, saveAgentWallet } from "@cipher/db";
import { store } from "../store";
import type { AgentContext } from "./index";

export function spawnAgentTool(ctx: AgentContext) {
  return tool({
    description:
      "Create a long-running autonomous agent after clarifying the goal in chat. Do NOT use for ordinary Q&A or short TA. Set withWallet only if the agent must hold/sign funds — then help fund it with create_plan (toAddress = agent wallet). User cannot chat with the agent afterward; they monitor/stop at /agents/{runId}.",
    inputSchema: z.object({
      goal: z.string().min(3).describe("What the autonomous agent should accomplish"),
      withWallet: z
        .boolean()
        .optional()
        .describe(
          "If true, create an ephemeral EVM wallet persisted for reclaim. Default false.",
        ),
      policy: z
        .record(z.unknown())
        .optional()
        .describe("Optional knobs / hints for the run"),
      preset: z
        .enum(["dca", "ta", "dao_research"])
        .optional()
        .describe("Optional recipe hint for the worker"),
    }),
    execute: async ({ goal, withWallet, policy, preset }) => {
      const wantWallet = withWallet === true;
      const mergedPolicy = {
        ...(policy ?? {}),
        ...(preset ? { preset } : {}),
      };

      let wallet = null as ReturnType<typeof createEphemeralAgentWallet> | null;
      if (wantWallet) {
        wallet = createEphemeralAgentWallet();
      }

      const run = createAgentRun({
        userId: ctx.userId,
        goal,
        type: preset ?? "general",
        policy: mergedPolicy,
        wallet: wallet
          ? {
              address: wallet.address,
              chainFamily: "evm",
              label: wallet.label,
              source: "ephemeral",
            }
          : null,
        withWallet: false, // already attached if needed
      });

      if (wallet?.privateKey) {
        try {
          const db = createDb();
          await saveAgentWallet(db, {
            userId: ctx.userId,
            agentRunId: run.id,
            address: wallet.address,
            privateKey: wallet.privateKey,
            label: wallet.label,
          });
        } catch (err) {
          agentRunStore.update(run.id, {
            status: "failed",
            error:
              err instanceof Error
                ? err.message
                : "agent_wallet_persist_failed",
            finishedAt: new Date().toISOString(),
          });
          return {
            error: "agent_wallet_persist_failed",
            message:
              err instanceof Error
                ? err.message
                : "Could not persist agent wallet key",
            runId: run.id,
          };
        }
        // Ensure in-memory run has public wallet (no private key).
        agentRunStore.setWallet(run.id, {
          address: wallet.address,
          chainFamily: "evm",
          label: wallet.label,
          source: "ephemeral",
        });
      }

      await store.listWallets(ctx.userId);
      startAgentRun(run.id);
      const started = agentRunStore.get(run.id)!;
      const pub = toPublicAgentRun(started);

      return {
        runId: pub.id,
        type: pub.type,
        status: pub.status,
        goal,
        withWallet: wantWallet,
        href: `/app/agents/${pub.id}`,
        wallet: pub.wallet
          ? {
              address: pub.wallet.address,
              label: pub.wallet.label,
              chainFamily: pub.wallet.chainFamily,
            }
          : null,
        needsFunding: Boolean(pub.wallet),
        fundingHint: pub.wallet
          ? `Fund this agent with create_plan using toAddress=${pub.wallet.address} from a signable user wallet. Then tell the user to monitor or Stop at /app/agents/${pub.id} — they cannot chat with the agent.`
          : undefined,
        message: pub.wallet
          ? `Agent started with ephemeral wallet ${pub.wallet.address}. Fund it via create_plan (toAddress), then open /app/agents/${pub.id} to monitor or stop.`
          : `Agent started (no wallet). Monitor or stop at /app/agents/${pub.id} — not a chat thread.`,
      };
    },
  });
}
