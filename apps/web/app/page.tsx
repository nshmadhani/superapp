"use client";

import Link from "next/link";
import { Bot, LayoutDashboard, MessageSquare } from "lucide-react";
import { DEMO_AGENTS, DEMO_CHATS } from "@/lib/demo/fixtures";

export default function HomePage() {
  return (
    <div className="cipher-scroll h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-16">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
            Cipher
          </h1>
          <p className="mt-2 max-w-md text-sm text-zinc-500">
            Research, move money, and run agents across your wallets — all in one
            place.
          </p>
        </div>

        <section>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
            <MessageSquare className="size-3" />
            Chats
          </p>
          <ul className="space-y-2">
            {DEMO_CHATS.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/c/${c.id}`}
                  className="block rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-100 transition hover:border-zinc-600"
                >
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
            <Bot className="size-3" />
            Agents
          </p>
          <ul className="space-y-2">
            {DEMO_AGENTS.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/agents/${a.id}`}
                  className="block rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-100 transition hover:border-zinc-600"
                >
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
            <LayoutDashboard className="size-3" />
            Dashboard
          </p>
          <Link
            href="/dashboard"
            className="block rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-100 transition hover:border-zinc-600"
          >
            Portfolio overview
            <span className="mt-0.5 block text-xs text-zinc-500">
              Wallets grouped · drill down by wallet
            </span>
          </Link>
        </section>
      </div>
    </div>
  );
}
