"use client";

import { DemoChatPanel } from "@/components/demo/demo-chat-panel";
import { useParams } from "next/navigation";

export default function ChatIdPage() {
  const params = useParams<{ chatId: string }>();
  return <DemoChatPanel chatId={params.chatId} />;
}
