import { streamText, stepCountIs, type ModelMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { cipherSystemPrompt } from "./system-prompt";
import { createCipherTools, type AgentContext } from "./tools";

export function createCipherAgent(ctx: AgentContext) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const openrouter = createOpenRouter({ apiKey });
  const modelId =
    process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4";
  const tools = createCipherTools(ctx);

  return {
    stream(messages: ModelMessage[]) {
      return streamText({
        model: openrouter(modelId),
        system: cipherSystemPrompt(new Date()),
        messages,
        tools,
        stopWhen: stepCountIs(12),
      });
    },
  };
}
