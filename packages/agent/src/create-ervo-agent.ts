import { streamText, stepCountIs, type ModelMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { ervoSystemPrompt } from "./system-prompt";
import { ensureAgentRuntime } from "./register-runtime";
import { createErvoTools, type AgentContext } from "./tools";

export function createErvoAgent(ctx: AgentContext) {
  ensureAgentRuntime();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const openrouter = createOpenRouter({ apiKey });
  const modelId =
    process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4";
  const tools = createErvoTools(ctx);

  return {
    stream(messages: ModelMessage[]) {
      return streamText({
        model: openrouter(modelId),
        system: ervoSystemPrompt(new Date()),
        messages,
        tools,
        stopWhen: stepCountIs(12),
      });
    },
  };
}
