import type { Tool } from "ai";
import { getPortfolioTool } from "./get-portfolio";
import { webSearchTool } from "./web-search";
import { getMarketOhlcTool } from "./get-market-ohlc";
import { getYieldsTool } from "./get-yields";
import { listWalletsTool } from "./list-wallets";
import { askUserTool } from "./ask-user";
import { createPlanTool } from "./create-plan";
import { createActionPlanTool } from "./create-action-plan";
import { simulatePlanTool } from "./simulate-plan";
import { executePlanTool } from "./execute-plan";
import { spawnAgentTool } from "./spawn-agent";
import { runCodeTool } from "./run-code";
import { getLifiStatusTool } from "./get-lifi-status";

export type AgentContext = {
  userId: string;
  /**
   * Addresses currently available in the Turnkey browser session
   * (embedded + connected). Used so tools don't recommend wallets
   * that can't sign right now.
   */
  signableAddresses?: string[];
};

export function createCipherTools(ctx: AgentContext): Record<string, Tool> {
  return {
    list_wallets: listWalletsTool(ctx),
    get_portfolio: getPortfolioTool(ctx),
    get_market_ohlc: getMarketOhlcTool(),
    web_search: webSearchTool(),
    run_code: runCodeTool(),
    get_yields: getYieldsTool(),
    ask_user: askUserTool(),
    create_plan: createPlanTool(ctx),
    create_action_plan: createActionPlanTool(ctx),
    get_lifi_status: getLifiStatusTool(),
    simulate_plan: simulatePlanTool(),
    execute_plan: executePlanTool(ctx),
    spawn_agent: spawnAgentTool(ctx),
  };
}
