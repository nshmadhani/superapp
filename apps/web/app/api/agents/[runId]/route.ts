import { AuthError, requireAuthUserId } from "@/lib/auth";
import { agentRunStore } from "@cipher/agent-jobs";

type Ctx = { params: Promise<{ runId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const userId = await requireAuthUserId();
    const { runId } = await ctx.params;
    const run = agentRunStore.get(runId);
    if (!run || run.userId !== userId) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return Response.json({ run });
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
