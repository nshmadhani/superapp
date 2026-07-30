import { AuthError, requireAuthUserId } from "@/lib/auth";
import { toPublicAgentRun } from "@ervo/agent-jobs";
import { ensureAgentRuntime, hydrateAgentRun } from "@ervo/agent";
import { createDb } from "@ervo/db";

type Ctx = { params: Promise<{ runId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    ensureAgentRuntime();
    const userId = await requireAuthUserId();
    const { runId } = await ctx.params;
    const db = createDb();
    const run = await hydrateAgentRun(db, userId, runId);
    if (!run || run.userId !== userId) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return Response.json({ run: toPublicAgentRun(run) });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "get_failed" },
      { status: 500 },
    );
  }
}
