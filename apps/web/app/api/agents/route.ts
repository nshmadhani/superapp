import { AuthError, requireAuthUserId } from "@/lib/auth";
import { createDb } from "@cipher/db";
import { provisionAgentWallet } from "@cipher/agent";
import {
  agentRunStore,
  createAgentRun,
  startAgentRun,
  type AgentType,
  type AgentWallet,
} from "@cipher/agent-jobs";

const TYPES = new Set<AgentType>(["dca", "ta", "dao_research"]);

function parseWallet(raw: unknown): AgentWallet | null {
  if (!raw || typeof raw !== "object") return null;
  const w = raw as Record<string, unknown>;
  const cipherWalletId = String(w.cipherWalletId ?? "");
  const address = String(w.address ?? "");
  const chainFamily = w.chainFamily === "solana" ? "solana" : "evm";
  const label = String(w.label ?? "Agent wallet");
  if (!cipherWalletId || !address) return null;
  return {
    cipherWalletId,
    address,
    chainFamily,
    label,
    turnkeyWalletId: w.turnkeyWalletId
      ? String(w.turnkeyWalletId)
      : undefined,
  };
}

async function userTurnkeySuborg(userId: string): Promise<string | null> {
  try {
    const db = createDb();
    const { data } = await db
      .from("users")
      .select("turnkey_suborg_id")
      .eq("id", userId)
      .maybeSingle();
    return (data?.turnkey_suborg_id as string | null) ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const userId = await requireAuthUserId();
    return Response.json({ runs: agentRunStore.list(userId) });
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
    const type = body.type as AgentType;
    const goal = String(body.goal ?? "").trim();
    const policy =
      body.policy && typeof body.policy === "object"
        ? (body.policy as Record<string, unknown>)
        : {};

    if (!TYPES.has(type)) {
      return Response.json({ error: "invalid_type" }, { status: 400 });
    }
    if (goal.length < 3) {
      return Response.json({ error: "goal_required" }, { status: 400 });
    }

    let wallet = parseWallet(body.wallet);
    const run = createAgentRun({
      userId,
      type,
      goal,
      policy,
      wallet,
    });

    if (!wallet) {
      const suborg = await userTurnkeySuborg(userId);
      wallet = await provisionAgentWallet({
        userId,
        type,
        runId: run.id,
        turnkeySuborgId: suborg,
      });
      agentRunStore.setWallet(run.id, wallet);
    }

    startAgentRun(run.id);
    const started = agentRunStore.get(run.id);
    return Response.json({ run: started }, { status: 201 });
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
