import type { Tool } from "ai";
import { getPortfolioTool } from "./get-portfolio";
import { webSearchTool } from "./web-search";
import { getYieldsTool } from "./get-yields";
import { listWalletsTool } from "./list-wallets";
import { askUserTool } from "./ask-user";
import { createPlanTool } from "./create-plan";
import { createActionPlanTool } from "./create-action-plan";
import { simulatePlanTool } from "./simulate-plan";
import { executePlanTool } from "./execute-plan";
import { spawnAgentTool } from "./spawn-agent";

export type AgentContext = {
  userId: string;
};

export function createCipherTools(ctx: AgentContext): Record<string, Tool> {
  return {
    list_wallets: listWalletsTool(ctx),
    get_portfolio: getPortfolioTool(ctx),
    web_search: webSearchTool(),
    get_yields: getYieldsTool(),
    ask_user: askUserTool(),
    create_plan: createPlanTool(ctx),
    create_action_plan: createActionPlanTool(ctx),
    simulate_plan: simulatePlanTool(),
    execute_plan: executePlanTool(ctx),
    spawn_agent: spawnAgentTool(ctx),
  };
}
