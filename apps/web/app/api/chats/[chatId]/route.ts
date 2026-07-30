import { AuthError, requireAuthUserId } from "@/lib/auth";
import { createDb } from "@ervo/db";

type Ctx = { params: Promise<{ chatId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const userId = await requireAuthUserId();
    const { chatId } = await ctx.params;
    const db = createDb();

    const { data: chat, error: chatErr } = await db
      .from("chats")
      .select("id, title, created_at, updated_at")
      .eq("id", chatId)
      .eq("user_id", userId)
      .maybeSingle();
    if (chatErr) throw chatErr;
    if (!chat) return Response.json({ error: "not_found" }, { status: 404 });

    const { data: messages, error: msgErr } = await db
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    if (msgErr) throw msgErr;

    return Response.json({ chat, messages: messages ?? [] });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "load_failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const userId = await requireAuthUserId();
    const { chatId } = await ctx.params;
    const body = await req.json();
    const db = createDb();
    const { data, error } = await db
      .from("chats")
      .update({
        title: body.title ? String(body.title) : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatId)
      .eq("user_id", userId)
      .select("id, title, created_at, updated_at")
      .single();
    if (error) throw error;
    return Response.json({ chat: data });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "update_failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const userId = await requireAuthUserId();
    const { chatId } = await ctx.params;
    const db = createDb();
    const { error } = await db
      .from("chats")
      .delete()
      .eq("id", chatId)
      .eq("user_id", userId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "delete_failed" },
      { status: 500 },
    );
  }
}
