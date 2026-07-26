"use client";

import { AuthState, useTurnkey } from "@turnkey/react-wallet-kit";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatEmptyState } from "@/components/chat/empty-state";
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
    <div className="relative flex h-full w-full flex-col">
      <div className="mx-auto flex w-full max-w-[57.6rem] flex-1 flex-col items-center justify-center px-4 pb-28">
        <div className="mx-auto w-[90%]">
        <ChatEmptyState onSuggest={(t) => void startChat(t)} denser />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>
      </div>

      <ChatComposer
        value={input}
        onChange={setInput}
        onSubmit={(t) => void startChat(t)}
        busy={starting}
        error={null}
        footer={null}
      />
    </div>
  );
}
