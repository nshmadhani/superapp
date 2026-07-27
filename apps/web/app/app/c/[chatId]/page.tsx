"use client";

import { ChatPanel } from "@/components/chat-panel";
import { AuthState, useTurnkey } from "@turnkey/react-wallet-kit";
import { useParams, useRouter } from "next/navigation";

export default function ChatIdPage() {
  const { authState, session, handleLogin } = useTurnkey();
  const loggedIn = authState === AuthState.Authenticated && !!session;
  const params = useParams<{ chatId: string }>();
  const router = useRouter();
  const chatId = params.chatId;

  if (!loggedIn) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm text-zinc-500">Log in to open this chat.</p>
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

  return (
    <ChatPanel chatId={chatId} onMissingChat={() => router.replace("/")} />
  );
}
