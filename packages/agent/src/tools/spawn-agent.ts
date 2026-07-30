import { tool } from "ai";
import { z } from "zod";
import {
  agentRunStore,
  createAgentRun,
  createEphemeralAgentWallet,
  startAgentRun,
  toPublicAgentRun,
} from "@ervo/agent-jobs";
import { createDb, listActiveAgentRuns, saveAgentWallet } from "@ervo/db";
import { ensureAgentRuntime } from "../register-runtime";
import { store } from "../store";
import type { AgentContext } from "./index";

export function spawnAgentTool(ctx: AgentContext) {
  return tool({
    description:
      "Create ONE long-running autonomous agent after clarifying the goal. Refuse if the user already has a queued/running agent — point them to Stop it first. Do NOT use for ordinary Q&A or short TA. Set withWallet only if the agent must hold/sign funds — then immediately fund it with create_plan (toAddress = agent wallet) including BOTH trading capital AND native gas (e.g. USDC+HYPE on HyperEVM). User monitors/stops at /agents/{runId}; they cannot chat with the agent.",
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
        .describe(
          "Optional recipe: dca=live buys, ta=OHLCV/indicators only, dao_research=governance brief. For open-ended research reports omit preset (general).",
        ),
    }),
    execute: async ({ goal, withWallet, policy, preset }) => {
      ensureAgentRuntime();

      const db = createDb();
      const active = await listActiveAgentRuns(db, ctx.userId);
      // Also catch in-memory runs not yet flushed.
      const memActive = agentRunStore
        .list(ctx.userId)
        .filter((r) =>
          r.status === "queued" ||
          r.status === "running" ||
          r.status === "needs_confirm",
        );
      const blockers = new Map<string, { id: string; goal: string; status: string; href: string }>();
      for (const r of active) {
        blockers.set(r.id, {
          id: r.id,
          goal: r.goal.slice(0, 120),
          status: r.status,
          href: `/app/agents/${r.id}`,
        });
      }
      for (const r of memActive) {
        blockers.set(r.id, {
          id: r.id,
          goal: r.goal.slice(0, 120),
          status: r.status,
          href: `/app/agents/${r.id}`,
        });
      }
      if (blockers.size > 0) {
        const first = [...blockers.values()][0]!;
        return {
          error: "agent_already_active",
          message: `Only one agent can run at a time. Stop the active agent first at ${first.href}`,
          activeAgents: [...blockers.values()],
          href: first.href,
        };
      }

      const wantWallet = withWallet === true;
      const mergedPolicy = {
        ...(policy ?? {}),
        ...(preset ? { preset } : {}),
        ...(wantWallet && (preset === "dca" || /every\s+\d+/i.test(goal))
          ? { live: true }
          : {}),
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
        withWallet: false,
      });

      if (wallet?.privateKey) {
        try {
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
          ? `REQUIRED: fund ${pub.wallet.address} with create_plan (toAddress=that address) using BOTH (1) trading capital and (2) native gas on the execution chain — e.g. HyperEVM = USDC + HYPE, Base = USDC + ETH. Never USDC-only; the agent cannot approve/swap without gas. Then point user to /app/agents/${pub.id} to monitor/Stop — they cannot chat with the agent.`
          : undefined,
        message: pub.wallet
          ? `Agent started with ephemeral wallet ${pub.wallet.address}. Fund capital + native gas via create_plan (toAddress), then open /app/agents/${pub.id} to monitor or stop.`
          : `Agent started (no wallet). Monitor or stop at /app/agents/${pub.id} — not a chat thread.`,
      };
    },
  });
}
