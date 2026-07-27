"use client";

import { Wallet } from "lucide-react";

export function TopBar() {
  return (
    <header className="flex h-12 items-center justify-end gap-2 border-b border-zinc-800 bg-zinc-950/80 px-3 backdrop-blur">
      <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-sm text-zinc-100">
        <Wallet className="size-3.5 text-zinc-400" />
        <span className="font-mono text-xs">0xA1b2…abcd</span>
      </div>
      <div className="ml-1 flex items-center gap-2 border-l border-zinc-800 pl-3">
        <span className="max-w-[140px] truncate text-xs text-zinc-500">
          Account
        </span>
      </div>
    </header>
  );
}
