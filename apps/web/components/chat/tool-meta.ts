import {
  Bot,
  CircleHelp,
  Landmark,
  List,
  Search,
  Sparkles,
  TrendingUp,
  Wallet,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

export type ToolMeta = {
  id: string;
  label: string;
  verb: string;
  description: string;
  Icon: LucideIcon;
};

const TOOLS: Record<string, ToolMeta> = {
  list_wallets: {
    id: "list_wallets",
    label: "Wallets",
    verb: "Listing wallets",
    description: "Load linked Turnkey wallets",
    Icon: Wallet,
  },
  get_portfolio: {
    id: "get_portfolio",
    label: "Portfolio",
    verb: "Fetching portfolio",
    description: "Balances and positions via Zerion",
    Icon: Landmark,
  },
  get_market_ohlc: {
    id: "get_market_ohlc",
    label: "Market",
    verb: "Fetching OHLCV",
    description: "Live Binance spot candles",
    Icon: TrendingUp,
  },
  web_search: {
    id: "web_search",
    label: "Research",
    verb: "Searching the web",
    description: "Live market and protocol research",
    Icon: Search,
  },
  run_code: {
    id: "run_code",
    label: "Code",
    verb: "Running code",
    description: "Short sandbox analysis in chat",
    Icon: Sparkles,
  },
  get_yields: {
    id: "get_yields",
    label: "Yields",
    verb: "Scanning yields",
    description: "Compare yield opportunities",
    Icon: TrendingUp,
  },
  ask_user: {
    id: "ask_user",
    label: "Clarify",
    verb: "Asking you",
    description: "Needs a choice before continuing",
    Icon: CircleHelp,
  },
  create_plan: {
    id: "create_plan",
    label: "Plan",
    verb: "Building trade plan",
    description: "Draft a confirm-gated transaction plan",
    Icon: Waypoints,
  },
  create_action_plan: {
    id: "create_action_plan",
    label: "Action plan",
    verb: "Building multi-step plan",
    description: "Swap/bridge + Morpho lend across wallets",
    Icon: Waypoints,
  },
  get_lifi_status: {
    id: "get_lifi_status",
    label: "LI.FI status",
    verb: "Checking transfer",
    description: "Bridge/swap status, refunds, and fail reasons",
    Icon: Waypoints,
  },
  simulate_plan: {
    id: "simulate_plan",
    label: "Simulate",
    verb: "Simulating plan",
    description: "Dry-run the planned steps",
    Icon: Sparkles,
  },
  execute_plan: {
    id: "execute_plan",
    label: "Execute",
    verb: "Executing plan",
    description: "Submit the approved plan",
    Icon: List,
  },
  spawn_agent: {
    id: "spawn_agent",
    label: "Agents",
    verb: "Spawning agent",
    description: "Start a long-running autonomous job",
    Icon: Bot,
  },
};

export function toolMeta(toolName: string): ToolMeta {
  return (
    TOOLS[toolName] ?? {
      id: toolName,
      label: toolName.replace(/_/g, " "),
      verb: `Running ${toolName.replace(/_/g, " ")}`,
      description: "Agent tool",
      Icon: Sparkles,
    }
  );
}

export function humanToolState(
  state: string | undefined,
): "pending" | "running" | "done" | "error" {
  switch (state) {
    case "output-available":
      return "done";
    case "output-error":
      return "error";
    case "input-streaming":
    case "input-available":
      return "running";
    default:
      return state ? "running" : "pending";
  }
}
