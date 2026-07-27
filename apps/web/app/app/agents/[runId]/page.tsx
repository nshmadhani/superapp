"use client";

import { AgentRunDetail } from "@/components/agents/agent-run-detail";
import { AuthState, useTurnkey } from "@turnkey/react-wallet-kit";
import { useParams } from "next/navigation";

export default function AgentRunPage() {
  const { authState, session, handleLogin } = useTurnkey();
  const params = useParams<{ runId: string }>();
  const loggedIn = authState === AuthState.Authenticated && !!session;

  if (!loggedIn) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm text-zinc-500">Log in to view this agent run.</p>
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

  return <AgentRunDetail runId={params.runId} />;
}
