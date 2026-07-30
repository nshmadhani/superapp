import { AuthError, requireAuthUserId } from "@/lib/auth";
import { createDb } from "@ervo/db";

export async function GET() {
  try {
    const userId = await requireAuthUserId();
    const db = createDb();
    const { data, error } = await db
      .from("chats")
      .select("id, title, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return Response.json({ chats: data ?? [] });
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
    const title = String(body.title ?? "New chat");
    const db = createDb();
    const { data, error } = await db
      .from("chats")
      .insert({ user_id: userId, title })
      .select("id, title, created_at, updated_at")
      .single();
    if (error) throw error;
    return Response.json({ chat: data });
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
