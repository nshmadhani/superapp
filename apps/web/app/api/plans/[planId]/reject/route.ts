import { AuthError, requireAuthUserId } from "@/lib/auth";
import { store } from "@ervo/agent";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ planId: string }> },
) {
  try {
    const userId = await requireAuthUserId();
    const { planId } = await ctx.params;
    const body = (await req.json()) as {
      confirmId?: string;
      planHash?: string;
    };
    if (!body.confirmId || !body.planHash) {
      return Response.json(
        { error: "confirmId_and_planHash_required" },
        { status: 400 },
      );
    }

    const result = await store.rejectConfirm(
      planId,
      body.confirmId,
      body.planHash,
      userId,
    );

    return Response.json({
      ok: true,
      planId: result.planId,
      message: "Plan rejected.",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "reject_failed" },
      { status: 400 },
    );
  }
}
