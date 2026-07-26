import { AuthError, requireAuthUserId } from "@/lib/auth";
import {
  agentRunStore,
  createAndStartAgentRun,
  type AgentType,
} from "@cipher/agent-jobs";

const TYPES = new Set<AgentType>(["dca", "ta", "dao_research"]);

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

    const run = createAndStartAgentRun({ userId, type, goal, policy });
    return Response.json({ run }, { status: 201 });
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
