import { AuthError, requireAuthUserId } from "@/lib/auth";
import { agentRunStore } from "@cipher/agent-jobs";

type Ctx = { params: Promise<{ runId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const userId = await requireAuthUserId();
    const { runId } = await ctx.params;
    const run = agentRunStore.get(runId);
    if (!run || run.userId !== userId) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    if (run.status === "succeeded" || run.status === "failed") {
      return Response.json({ run });
    }
    const updated = agentRunStore.update(runId, {
      status: "cancelled",
      finishedAt: new Date().toISOString(),
      error: "cancelled_by_user",
    });
    return Response.json({ run: updated });
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
