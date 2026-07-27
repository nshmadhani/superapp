export type AgentType = "dca" | "ta" | "dao_research";

export type AgentRunStatus =
  | "queued"
  | "running"
  | "needs_confirm"
  | "succeeded"
  | "failed"
  | "cancelled";

export type AgentStepStatus = "pending" | "running" | "done" | "error" | "skipped";

export type AgentStep = {
  id: string;
  label: string;
  status: AgentStepStatus;
  detail?: string;
  at: string;
};

export type AgentArtifactSource = "live" | "fallback";

/** Dedicated Turnkey wallet owned by this agent run (not the user's main wallet). */
export type AgentWallet = {
  cipherWalletId: string;
  address: string;
  chainFamily: "evm" | "solana";
  turnkeyWalletId?: string;
  label: string;
};

export type DcaArtifact = {
  kind: "dca";
  asset: string;
  amountUsd: number;
  cadence: string;
  nextRunAt: string;
  legs: Array<{ date: string; amountUsd: number }>;
  summary: string;
  /** Agent's dedicated wallet that would execute the DCA buys. */
  walletAddress?: string;
  walletLabel?: string;
};

export type TaArtifact = {
  kind: "ta";
  symbol: string;
  interval: string;
  bias: "long" | "short" | "neutral";
  confidence: number;
  summary: string;
  indicators: {
    sma20?: number;
    sma50?: number;
    rsi14?: number;
    lastClose?: number;
  };
  series: Array<{ t: number; c: number }>;
  walletAddress?: string;
};

export type DaoArtifact = {
  kind: "dao_research";
  topic: string;
  summary: string;
  bullets: string[];
  citations: Array<{ title: string; url: string }>;
  walletAddress?: string;
};

export type AgentArtifact = DcaArtifact | TaArtifact | DaoArtifact;

export type AgentRun = {
  id: string;
  userId: string;
  type: AgentType;
  goal: string;
  policy: Record<string, unknown>;
  status: AgentRunStatus;
  steps: AgentStep[];
  artifact: AgentArtifact | null;
  source: AgentArtifactSource | null;
  /** Isolated wallet for this agent — provisioned at create. */
  wallet: AgentWallet | null;
  sandboxId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
};

export type CreateAgentInput = {
  userId: string;
  type: AgentType;
  goal: string;
  policy?: Record<string, unknown>;
  wallet?: AgentWallet | null;
};
