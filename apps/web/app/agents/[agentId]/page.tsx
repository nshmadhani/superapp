"use client";

import { AgentPanel } from "@/components/demo/agent-panel";
import { useParams } from "next/navigation";

export default function AgentPage() {
  const params = useParams<{ agentId: string }>();
  return <AgentPanel agentId={params.agentId} />;
}
