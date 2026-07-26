import { createCipherAgent } from "@cipher/agent";
import { AuthError, requireAuthUserId } from "@/lib/auth";
import { createDb } from "@cipher/db";
import { convertToModelMessages, type UIMessage } from "ai";

export const maxDuration = 60;

function lastUserText(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== "user") continue;
    const text = (m.parts ?? [])
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n")
      .trim();
    return text || null;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const userId = await requireAuthUserId();
    const body = await req.json();
    const messages = (body.messages ?? []) as UIMessage[];
    const chatId = body.chatId ? String(body.chatId) : null;

    if (chatId) {
      const db = createDb();
      const { data: chat } = await db
        .from("chats")
        .select("id")
        .eq("id", chatId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!chat) {
        return Response.json({ error: "chat_not_found" }, { status: 404 });
      }

      const lastText = lastUserText(messages);
      if (lastText) {
        const { data: latest } = await db
          .from("chat_messages")
          .select("role, content")
          .eq("chat_id", chatId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const latestText =
          latest?.role === "user" &&
          latest.content &&
          typeof latest.content === "object" &&
          "text" in latest.content
            ? String((latest.content as { text?: string }).text ?? "")
            : null;
        if (latestText !== lastText) {
          await db.from("chat_messages").insert({
            chat_id: chatId,
            role: "user",
            content: { text: lastText },
          });
        }
        const { data: meta } = await db
          .from("chats")
          .select("title")
          .eq("id", chatId)
          .single();
        if (meta?.title === "New chat") {
          await db
            .from("chats")
            .update({
              title: lastText.slice(0, 60),
              updated_at: new Date().toISOString(),
            })
            .eq("id", chatId);
        } else {
          await db
            .from("chats")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", chatId);
        }
      }
    }

    const agent = createCipherAgent({ userId });
    const modelMessages = await convertToModelMessages(messages);
    const result = agent.stream(modelMessages);

    if (chatId) {
      void result.text.then(async (text) => {
        if (!text) return;
        try {
          const db = createDb();
          await db.from("chat_messages").insert({
            chat_id: chatId,
            role: "assistant",
            content: { text },
          });
          await db
            .from("chats")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", chatId);
        } catch (e) {
          console.error("persist assistant message", e);
        }
      });
    }

    return result.toUIMessageStreamResponse();
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    console.error(err);
    return Response.json(
      { error: err instanceof Error ? err.message : "chat_failed" },
      { status: 500 },
    );
  }
}
