import { applyAuthCookie, formatUnknownError, syncTurnkeyUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@ervo/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    if (!hasSupabaseEnv()) {
      return NextResponse.json(
        {
          error:
            "Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL on the server — set them in Vercel env and redeploy",
        },
        { status: 500 },
      );
    }

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
    const message = formatUnknownError(err);
    console.error("auth sync failed:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
