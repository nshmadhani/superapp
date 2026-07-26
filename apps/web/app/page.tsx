"use client";

import { AuthState, useTurnkey } from "@turnkey/react-wallet-kit";
import { ArrowUp, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { waitForCipherSession } from "@/lib/cipher-session";

export default function HomePage() {
  const { authState, session, handleLogin } = useTurnkey();
  const loggedIn = authState === AuthState.Authenticated && !!session;
  const router = useRouter();
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startChat(text: string) {
    const trimmed = text.trim();
    if (!trimmed || starting) return;
    if (!loggedIn) {
      await handleLogin();
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const ready = await waitForCipherSession();
      if (!ready) throw new Error("Account sync timed out — try again");
      const created = await fetch("/api/chats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: trimmed.slice(0, 60) }),
      });
      if (!created.ok) throw new Error("Could not create chat");
      const body = await created.json();
      sessionStorage.setItem(`cipher:pending:${body.chat.id}`, trimmed);
      router.push(`/c/${body.chat.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start chat");
      setStarting(false);
    }
  }

  if (!loggedIn) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
          Cipher
        </h1>
        <p className="max-w-sm text-center text-sm text-zinc-500">
          Log in with Turnkey to create an account, open an embedded wallet, and
          chat with history.
        </p>
        <button
          type="button"
          onClick={() => void handleLogin()}
          className="rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950 hover:bg-white"
        >
          Log in
        </button>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex h-full w-full max-w-3xl flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 pb-36 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
          Cipher
        </h1>
        <p className="max-w-sm text-sm text-zinc-500">
          Ask about portfolios, research markets, or plan a trade.
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent px-4 pb-4 pt-10">
        <form
          className="pointer-events-auto mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-2 shadow-lg shadow-black/40 backdrop-blur"
          onSubmit={(e) => {
            e.preventDefault();
            void startChat(input);
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void startChat(input);
              }
            }}
            rows={1}
            placeholder="Message Cipher…"
            className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          <button
            type="submit"
            disabled={starting || !input.trim()}
            aria-label="Send"
            className="mb-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-950 disabled:opacity-30"
          >
            {starting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
