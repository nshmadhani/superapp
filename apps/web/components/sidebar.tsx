"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AuthState, useTurnkey } from "@turnkey/react-wallet-kit";
import { Bot, LayoutDashboard, MessageSquare, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { onCipherAuthed, waitForCipherSession } from "@/lib/cipher-session";

type ChatRow = {
  id: string;
  title: string;
  updated_at: string;
};

export function Sidebar() {
  const { authState, session, handleLogin } = useTurnkey();
  const loggedIn = authState === AuthState.Authenticated && !!session;
  const [chats, setChats] = useState<ChatRow[]>([]);
  const pathname = usePathname();
  const router = useRouter();

  const refresh = useCallback(async () => {
    if (!loggedIn) {
      setChats([]);
      return;
    }
    const ready = await waitForCipherSession(8_000);
    if (!ready) {
      setChats([]);
      return;
    }
    const res = await fetch("/api/chats");
    if (!res.ok) {
      setChats([]);
      return;
    }
    const data = await res.json();
    setChats(data.chats ?? []);
  }, [loggedIn]);

  useEffect(() => {
    void refresh();
    return onCipherAuthed(() => {
      void refresh();
    });
  }, [refresh, pathname]);

  async function newChat() {
    if (!loggedIn) {
      await handleLogin();
      return;
    }
    router.push("/");
  }

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
        >
          <MessageSquare className="size-4 text-zinc-400" />
          Cipher
        </Link>
        <button
          type="button"
          onClick={() => void newChat()}
          aria-label="New chat"
          title="New chat"
          className="inline-flex size-8 items-center justify-center rounded-lg border border-zinc-800 text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-900 hover:text-white"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <nav className="space-y-0.5 px-2 pb-2">
        <Link
          href="/"
          className={
            pathname === "/" || pathname.startsWith("/c/")
              ? "flex items-center gap-2 rounded-lg bg-zinc-800 px-2.5 py-2 text-sm text-zinc-50"
              : "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
          }
        >
          <MessageSquare className="size-4" />
          Chat
        </Link>
        <Link
          href="/agents"
          className={
            pathname.startsWith("/agents")
              ? "flex items-center gap-2 rounded-lg bg-zinc-800 px-2.5 py-2 text-sm text-zinc-50"
              : "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
          }
        >
          <Bot className="size-4" />
          Agents
        </Link>
        <Link
          href="/dashboard"
          className={
            pathname === "/dashboard"
              ? "flex items-center gap-2 rounded-lg bg-zinc-800 px-2.5 py-2 text-sm text-zinc-50"
              : "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
          }
        >
          <LayoutDashboard className="size-4" />
          Dashboard
        </Link>
      </nav>

      <div className="cipher-scroll flex-1 overflow-y-auto px-2 pb-4">
        <p className="px-2 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
          Chats
        </p>
        {!loggedIn ? (
          <p className="px-2 py-2 text-xs text-zinc-500">
            Log in to save chat history.
          </p>
        ) : chats.length === 0 ? (
          <p className="px-2 py-2 text-xs text-zinc-500">No chats yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {chats.map((c) => {
              const active = pathname === `/c/${c.id}`;
              return (
                <li key={c.id}>
                  <Link
                    href={`/c/${c.id}`}
                    className={
                      active
                        ? "block truncate rounded-lg bg-zinc-800 px-2.5 py-2 text-sm text-zinc-50"
                        : "block truncate rounded-lg px-2.5 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
                    }
                  >
                    {c.title || "New chat"}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
