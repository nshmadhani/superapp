"use client";

import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 bg-zinc-950 text-zinc-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
