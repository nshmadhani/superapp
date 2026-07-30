import { AuthError, requireAuthUserId } from "@/lib/auth";
import { destroyAgentRun, ensureAgentRuntime } from "@ervo/agent";

type Ctx = { params: Promise<{ runId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    ensureAgentRuntime();
    const userId = await requireAuthUserId();
    const { runId } = await ctx.params;
    const result = await destroyAgentRun({ userId, runId });
    if (!result.run) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return Response.json({
      run: result.run,
      reclaim: result.reclaim,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "cancel_failed" },
      { status: 500 },
    );
  }
}
