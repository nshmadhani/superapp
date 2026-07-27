"use client";

import { useEffect, useState } from "react";
import type { UIMessage } from "ai";
import type { DemoChat } from "./fixtures";

function textOf(parts: UIMessage["parts"]): string {
  return (parts ?? [])
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

function isToolPart(
  part: UIMessage["parts"][number],
): part is UIMessage["parts"][number] & {
  type: string;
  toolCallId?: string;
  state?: string;
  output?: unknown;
} {
  return (
    Boolean(part) &&
    typeof part === "object" &&
    "type" in part &&
    String(part.type).startsWith("tool-")
  );
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = window.setTimeout(() => resolve(), ms);
    const onAbort = () => {
      window.clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function patchMessage(
  messages: UIMessage[],
  id: string,
  updater: (m: UIMessage) => UIMessage,
): UIMessage[] {
  return messages.map((m) => (m.id === id ? updater(m) : m));
}

/**
 * Scripted demo playback: typewriter user prompt, then tools
 * running → done in sequence, then streamed assistant text.
 */
export function useDemoPlayback(chat: DemoChat | undefined) {
  const [messages, setMessages] = useState<UIMessage[]>(
    () => chat?.messages ?? [],
  );
  const [busy, setBusy] = useState(false);
  const enabled = Boolean(chat?.playback);

  useEffect(() => {
    if (!chat) {
      setMessages([]);
      setBusy(false);
      return;
    }

    if (!chat.playback) {
      setMessages(chat.messages);
      setBusy(false);
      return;
    }

    const ac = new AbortController();
    const { signal } = ac;

    async function play() {
      setMessages([]);
      setBusy(true);

      try {
        for (const full of chat!.messages) {
          if (full.role === "user") {
            await sleep(450, signal);
            const fullText = textOf(full.parts);
            setMessages((prev) => [
              ...prev,
              { id: full.id, role: "user", parts: [{ type: "text", text: "" }] },
            ]);
            for (let i = 0; i < fullText.length; i++) {
              const slice = fullText.slice(0, i + 1);
              setMessages((prev) =>
                patchMessage(prev, full.id, (m) => ({
                  ...m,
                  parts: [{ type: "text", text: slice }],
                })),
              );
              const ch = fullText[i]!;
              await sleep(ch === " " ? 10 : ch === "," || ch === "." ? 40 : 16, signal);
            }
            await sleep(550, signal);
            continue;
          }

          // Assistant: empty shell → tools → text
          await sleep(280, signal);
          setMessages((prev) => [
            ...prev,
            { id: full.id, role: "assistant", parts: [] },
          ]);
          await sleep(700, signal);

          const toolParts = (full.parts ?? []).filter(isToolPart);
          const answer = textOf(full.parts);

          for (const tool of toolParts) {
            const toolCallId = tool.toolCallId ?? `tc-${tool.type}`;
            const runningPart = {
              ...tool,
              toolCallId,
              state: "input-available",
              output: undefined,
            } as UIMessage["parts"][number];

            setMessages((prev) =>
              patchMessage(prev, full.id, (m) => ({
                ...m,
                parts: [...m.parts, runningPart],
              })),
            );
            await sleep(1100, signal);

            setMessages((prev) =>
              patchMessage(prev, full.id, (m) => ({
                ...m,
                parts: m.parts.map((p) => {
                  if (
                    isToolPart(p) &&
                    (p.toolCallId ?? "") === toolCallId
                  ) {
                    return {
                      ...tool,
                      toolCallId,
                      state: "output-available",
                    } as UIMessage["parts"][number];
                  }
                  return p;
                }),
              })),
            );
            await sleep(480, signal);
          }

          if (answer) {
            setMessages((prev) =>
              patchMessage(prev, full.id, (m) => ({
                ...m,
                parts: [...m.parts, { type: "text", text: "" }],
              })),
            );

            const step = 4;
            for (let i = 0; i < answer.length; i += step) {
              const slice = answer.slice(0, Math.min(i + step, answer.length));
              setMessages((prev) =>
                patchMessage(prev, full.id, (m) => {
                  const parts = [...m.parts];
                  for (let j = parts.length - 1; j >= 0; j--) {
                    if (parts[j]?.type === "text") {
                      parts[j] = { type: "text", text: slice };
                      break;
                    }
                  }
                  return { ...m, parts };
                }),
              );
              await sleep(14, signal);
            }
          }

          await sleep(200, signal);
        }

        setBusy(false);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setBusy(false);
        // Fall back to full transcript if playback errors.
        setMessages(chat!.messages);
      }
    }

    void play();
    return () => ac.abort();
  }, [chat]);

  if (!enabled) {
    return {
      messages: chat?.messages ?? [],
      busy: false,
      preferAgentOpen: false,
    };
  }

  return {
    messages,
    busy,
    preferAgentOpen: busy,
  };
}
