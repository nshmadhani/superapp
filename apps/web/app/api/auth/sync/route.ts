import { syncTurnkeyUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const turnkeyUserId = String(body.turnkeyUserId ?? "");
    const turnkeySuborgId = String(body.turnkeySuborgId ?? "");
    const email = body.email ? String(body.email) : null;

    if (!turnkeyUserId || !turnkeySuborgId) {
      return Response.json({ error: "missing_turnkey_identity" }, { status: 400 });
    }

    const result = await syncTurnkeyUser({
      turnkeyUserId,
      turnkeySuborgId,
      email,
    });

    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: err instanceof Error ? err.message : "sync_failed" },
      { status: 500 },
    );
  }
}
