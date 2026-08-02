import { createErvoAgent } from "@ervo/agent";
import { AuthError, requireAuthUserId } from "@/lib/auth";
import { createDb } from "@ervo/db";
import { convertToModelMessages, type UIMessage } from "ai";

/** Tool-heavy turns often exceed 60s; aborting here drops assistant rows. */
export const maxDuration = 300;

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

function hasUsableAssistantContent(message: UIMessage): boolean {
  const text = textFromParts(message.parts);
  if (text.length > 0) return true;
  return (message.parts?.length ?? 0) > 0;
}

function contentMessageId(content: unknown): string | null {
  if (!content || typeof content !== "object" || !("id" in content)) return null;
  const id = (content as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

async function persistAssistantMessage(
  chatId: string,
  responseMessage: UIMessage,
) {
  if (!hasUsableAssistantContent(responseMessage)) return;

  const db = createDb();
  const payload = contentPayload(responseMessage);

  // Idempotent: skip if this assistant message id was already stored.
  if (payload.id) {
    const { data: recent, error: recentErr } = await db
      .from("chat_messages")
      .select("content")
      .eq("chat_id", chatId)
      .eq("role", "assistant")
      .order("created_at", { ascending: false })
      .limit(20);
    if (recentErr) {
      console.error("persist assistant dedupe lookup failed", {
        chatId,
        messageId: payload.id,
        error: recentErr,
      });
      throw recentErr;
    }
    const already = (recent ?? []).some(
      (row) => contentMessageId(row.content) === payload.id,
    );
    if (already) return;
  }

  const { error: insertErr } = await db.from("chat_messages").insert({
    chat_id: chatId,
    role: "assistant",
    content: payload,
  });
  if (insertErr) {
    console.error("persist assistant message failed", {
      chatId,
      messageId: payload.id,
      error: insertErr,
    });
    throw insertErr;
  }

  const { error: touchErr } = await db
    .from("chats")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", chatId);
  if (touchErr) {
    console.error("persist assistant chat touch failed", {
      chatId,
      messageId: payload.id,
      error: touchErr,
    });
  }
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
        if (!chatId) return;
        // Persist usable content even when the client aborted (chat switch /
        // navigation). Skip empty shells so Stop-with-nothing stays clean.
        if (!hasUsableAssistantContent(responseMessage)) return;
        try {
          await persistAssistantMessage(chatId, responseMessage);
          if (isAborted) {
            console.info("persisted assistant after client abort", {
              chatId,
              messageId: responseMessage.id,
            });
          }
        } catch (e) {
          console.error("persist assistant message", {
            chatId,
            messageId: responseMessage.id,
            isAborted,
            error: e,
          });
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
