"use client";

import { AgentsHome } from "@/components/agents/agents-home";
import { AuthState, useTurnkey } from "@turnkey/react-wallet-kit";

export default function AgentsPage() {
  const { authState, session, handleLogin } = useTurnkey();
  const loggedIn = authState === AuthState.Authenticated && !!session;

  if (!loggedIn) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm text-zinc-500">Log in to run autonomous agents.</p>
        <button
          type="button"
          onClick={() => void handleLogin()}
          className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950"
        >
          Log in
        </button>
      </div>
    );
  }

  return <AgentsHome />;
}
