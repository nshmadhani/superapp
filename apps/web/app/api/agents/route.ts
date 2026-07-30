import { AuthError, requireAuthUserId } from "@/lib/auth";
import {
  agentRunStore,
  createAgentRun,
  createEphemeralAgentWallet,
  startAgentRun,
  toPublicAgentRun,
  type AgentWallet,
} from "@ervo/agent-jobs";
import {
  backfillOrphanAgentRuns,
  ensureAgentRuntime,
  listHydratedAgentRuns,
  resumeOpenAgentRuns,
} from "@ervo/agent";
import { createDb, listActiveAgentRuns, saveAgentWallet } from "@ervo/db";

function parseWallet(raw: unknown): AgentWallet | null {
  if (!raw || typeof raw !== "object") return null;
  const w = raw as Record<string, unknown>;
  const address = String(w.address ?? "");
  const label = String(w.label ?? "Agent wallet");
  if (!address) return null;
  // Never accept client-supplied private keys.
  return {
    address,
    chainFamily: w.chainFamily === "solana" ? "solana" : "evm",
    label,
    source: "ephemeral",
    ervoWalletId: w.ervoWalletId ? String(w.ervoWalletId) : undefined,
    turnkeyWalletId: w.turnkeyWalletId ? String(w.turnkeyWalletId) : undefined,
  };
}

export async function GET() {
  try {
    ensureAgentRuntime();
    const userId = await requireAuthUserId();
    const db = createDb();
    await backfillOrphanAgentRuns(db, userId);
    const runs = await listHydratedAgentRuns(db, userId);
    resumeOpenAgentRuns(runs);
    return Response.json({ runs: runs.map(toPublicAgentRun) });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "list_failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    ensureAgentRuntime();
    const userId = await requireAuthUserId();
    const body = await req.json().catch(() => ({}));
    const goal = String(body.goal ?? "").trim();
    const type = body.type ? String(body.type).trim() : "general";
    const withWallet = body.withWallet === true;
    const policy =
      body.policy && typeof body.policy === "object"
        ? (body.policy as Record<string, unknown>)
        : {};

    if (goal.length < 3) {
      return Response.json({ error: "goal_required" }, { status: 400 });
    }

    const db = createDb();
    const active = await listActiveAgentRuns(db, userId);
    const memActive = agentRunStore
      .list(userId)
      .filter(
        (r) =>
          r.status === "queued" ||
          r.status === "running" ||
          r.status === "needs_confirm",
      );
    if (active.length > 0 || memActive.length > 0) {
      const first = active[0] ?? memActive[0]!;
      return Response.json(
        {
          error: "agent_already_active",
          message: "Only one agent can run at a time. Stop the active one first.",
          activeRunId: first.id,
          href: `/app/agents/${first.id}`,
        },
        { status: 409 },
      );
    }

    let wallet = parseWallet(body.wallet);
    let privateKey: string | undefined;
    if (!wallet && withWallet) {
      const created = createEphemeralAgentWallet();
      wallet = {
        address: created.address,
        chainFamily: "evm",
        label: created.label,
        source: "ephemeral",
      };
      privateKey = created.privateKey;
    }

    const run = createAgentRun({
      userId,
      type,
      goal,
      policy,
      wallet,
      withWallet: false,
    });

    if (privateKey && wallet) {
      await saveAgentWallet(db, {
        userId,
        agentRunId: run.id,
        address: wallet.address,
        privateKey,
        label: wallet.label,
      });
    }

    startAgentRun(run.id);
    const started = agentRunStore.get(run.id);
    return Response.json(
      { run: started ? toPublicAgentRun(started) : null },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "create_failed" },
      { status: 500 },
    );
  }
}
