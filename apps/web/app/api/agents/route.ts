import { AuthError, requireAuthUserId } from "@/lib/auth";
import {
  agentRunStore,
  createAgentRun,
  createEphemeralAgentWallet,
  startAgentRun,
  toPublicAgentRun,
  type AgentWallet,
} from "@cipher/agent-jobs";
import { createDb, saveAgentWallet } from "@cipher/db";

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
    cipherWalletId: w.cipherWalletId ? String(w.cipherWalletId) : undefined,
    turnkeyWalletId: w.turnkeyWalletId ? String(w.turnkeyWalletId) : undefined,
  };
}

export async function GET() {
  try {
    const userId = await requireAuthUserId();
    const runs = agentRunStore.list(userId).map(toPublicAgentRun);
    return Response.json({ runs });
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
      const db = createDb();
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
