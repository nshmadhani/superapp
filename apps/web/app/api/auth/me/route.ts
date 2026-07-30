import { getAuthUserId } from "@/lib/auth";
import { createDb } from "@ervo/db";

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return Response.json({ user: null });

  try {
    const db = createDb();
    const { data } = await db
      .from("users")
      .select("id, email, turnkey_user_id, turnkey_suborg_id, created_at")
      .eq("id", userId)
      .maybeSingle();
    if (!data) return Response.json({ user: null });
    return Response.json({ user: data });
  } catch {
    return Response.json({ user: null });
  }
}
