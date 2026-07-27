import {
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
  web_search: {
    id: "web_search",
    label: "Research",
    verb: "Searching the web",
    description: "Live market and protocol research",
    Icon: Search,
  },
  get_yields: {
    id: "get_yields",
    label: "Yields",
    verb: "Scanning yields",
    description: "Compare yield opportunities",
    Icon: TrendingUp,
  },
  get_price_history: {
    id: "get_price_history",
    label: "Price history",
    verb: "Loading price history",
    description: "OHLCV and historical closes",
    Icon: TrendingUp,
  },
  analyze_technicals: {
    id: "analyze_technicals",
    label: "Technicals",
    verb: "Analyzing technicals",
    description: "Structure, EMAs, RSI, S/R, volume",
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
