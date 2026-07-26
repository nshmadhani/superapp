"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  LayoutDashboard,
  MessageSquare,
} from "lucide-react";
import { DEMO_AGENTS, DEMO_CHATS } from "@/lib/demo/fixtures";

function navClass(active: boolean) {
  return active
    ? "flex items-center gap-2 rounded-lg bg-zinc-800 px-2.5 py-2 text-sm text-zinc-50"
    : "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100";
}

function itemClass(active: boolean) {
  return active
    ? "block truncate rounded-lg bg-zinc-800 px-2.5 py-2 text-sm text-zinc-50"
    : "block truncate rounded-lg px-2.5 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100";
}

export function Sidebar() {
  const pathname = usePathname();

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
      </div>

      <nav className="px-2 pb-2">
        <Link
          href="/dashboard"
          className={navClass(pathname === "/dashboard")}
        >
          <LayoutDashboard className="size-4" />
          Dashboard
        </Link>
      </nav>

      <div className="cipher-scroll flex-1 overflow-y-auto px-2 pb-4">
        <p className="px-2 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
          Chats
        </p>
        <ul className="mb-4 space-y-0.5">
          {DEMO_CHATS.map((c) => {
            const href = `/c/${c.id}`;
            return (
              <li key={c.id}>
                <Link href={href} className={itemClass(pathname === href)}>
                  {c.title}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="flex items-center gap-1.5 px-2 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
          <Bot className="size-3" />
          Agents
        </p>
        <ul className="space-y-0.5">
          {DEMO_AGENTS.map((a) => {
            const href = `/agents/${a.id}`;
            return (
              <li key={a.id}>
                <Link href={href} className={itemClass(pathname === href)}>
                  {a.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
