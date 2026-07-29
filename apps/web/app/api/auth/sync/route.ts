import { applyAuthCookie, syncTurnkeyUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const turnkeyUserId = String(body.turnkeyUserId ?? "");
    const turnkeySuborgId = String(body.turnkeySuborgId ?? "");
    const email = body.email ? String(body.email) : null;

    if (!turnkeyUserId || !turnkeySuborgId) {
      return NextResponse.json(
        { error: "missing_turnkey_identity" },
        { status: 400 },
      );
    }

    const result = await syncTurnkeyUser({
      turnkeyUserId,
      turnkeySuborgId,
      email,
    });

    const res = NextResponse.json({ ok: true, ...result });
    // Set on the Response so Proxy/middleware cannot drop cookies().set().
    applyAuthCookie(res, result.userId);
    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "sync_failed" },
      { status: 500 },
    );
  }
}
