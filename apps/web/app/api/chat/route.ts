import { createErvoAgent } from "@ervo/agent";
import { AuthError, requireAuthUserId } from "@/lib/auth";
import { createDb } from "@ervo/db";
import { convertToModelMessages, type UIMessage } from "ai";

export const maxDuration = 60;

function textFromParts(parts: UIMessage["parts"] | undefined): string {
  return (parts ?? [])
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

function lastUserMessage(messages: UIMessage[]): UIMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user") return m;
  }
  return null;
}

function contentPayload(message: UIMessage) {
  return {
    text: textFromParts(message.parts),
    parts: message.parts ?? [],
    id: message.id,
  };
}

export async function POST(req: Request) {
  try {
    const userId = await requireAuthUserId();
    const body = await req.json();
    const messages = (body.messages ?? []) as UIMessage[];
    const chatId = body.chatId ? String(body.chatId) : null;
    const signableAddresses = Array.isArray(body.signableAddresses)
      ? (body.signableAddresses as unknown[])
          .filter((a): a is string => typeof a === "string" && a.length > 0)
          .slice(0, 64)
      : undefined;

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

      const lastUser = lastUserMessage(messages);
      const lastText = lastUser ? textFromParts(lastUser.parts) : null;
      if (lastUser && lastText) {
        const { data: latest } = await db
          .from("chat_messages")
          .select("role, content")
          .eq("chat_id", chatId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const latestId =
          latest?.role === "user" &&
          latest.content &&
          typeof latest.content === "object" &&
          "id" in latest.content
            ? String((latest.content as { id?: string }).id ?? "")
            : null;
        const latestText =
          latest?.role === "user" &&
          latest.content &&
          typeof latest.content === "object" &&
          "text" in latest.content
            ? String((latest.content as { text?: string }).text ?? "")
            : null;
        const alreadyStored =
          (latestId && latestId === lastUser.id) || latestText === lastText;
        if (!alreadyStored) {
          await db.from("chat_messages").insert({
            chat_id: chatId,
            role: "user",
            content: contentPayload(lastUser),
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

    const agent = createErvoAgent({ userId, signableAddresses });
    const modelMessages = await convertToModelMessages(messages);
    const result = agent.stream(modelMessages);

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: () => crypto.randomUUID(),
      onFinish: async ({ responseMessage, isAborted }) => {
        if (!chatId || isAborted) return;
        const text = textFromParts(responseMessage.parts);
        if (!text && !(responseMessage.parts?.length > 0)) return;
        try {
          const db = createDb();
          await db.from("chat_messages").insert({
            chat_id: chatId,
            role: "assistant",
            content: contentPayload(responseMessage),
          });
          await db
            .from("chats")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", chatId);
        } catch (e) {
          console.error("persist assistant message", e);
        }
      },
    });
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
