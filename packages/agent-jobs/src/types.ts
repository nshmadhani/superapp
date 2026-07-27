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

/**
 * Optional agent wallet. Ephemeral = server-held key for this run only.
 * `privateKey` is server-only and must never be returned to the client.
 */
export type AgentWallet = {
  address: string;
  chainFamily: "evm" | "solana";
  label: string;
  source: "ephemeral";
  /** Server-only signing material — strip before API responses. */
  privateKey?: `0x${string}`;
  /** @deprecated legacy Turnkey fields */
  cipherWalletId?: string;
  turnkeyWalletId?: string;
};

/** @deprecated Prefer freeform agents; kept for preset routing / old runs. */
export type AgentType = "general" | "dca" | "ta" | "dao_research" | (string & {});

export type DcaArtifact = {
  kind: "dca";
  asset: string;
  amountUsd: number;
  cadence: string;
  nextRunAt: string;
  legs: Array<{ date: string; amountUsd: number }>;
  summary: string;
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

export type GeneralArtifact = {
  kind: "general";
  summary: string;
  bullets: string[];
  citations?: Array<{ title: string; url: string }>;
  walletAddress?: string;
};

export type AgentArtifact =
  | DcaArtifact
  | TaArtifact
  | DaoArtifact
  | GeneralArtifact;

export type AgentRun = {
  id: string;
  userId: string;
  /** Display / preset hint — not a closed product enum. */
  type: AgentType;
  goal: string;
  policy: Record<string, unknown>;
  status: AgentRunStatus;
  steps: AgentStep[];
  artifact: AgentArtifact | null;
  source: AgentArtifactSource | null;
  /** Optional — only when the agent needs to hold/sign funds. */
  wallet: AgentWallet | null;
  sandboxId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
};

export type CreateAgentInput = {
  userId: string;
  goal: string;
  /** Optional preset hint (`dca` | `ta` | `dao_research`) or freeform label. */
  type?: AgentType;
  policy?: Record<string, unknown>;
  wallet?: AgentWallet | null;
  /** If true, create an ephemeral EVM wallet at start (money agents). */
  withWallet?: boolean;
};

/** Public shape of a run (no private keys). */
export type PublicAgentRun = Omit<AgentRun, "wallet"> & {
  wallet: Omit<AgentWallet, "privateKey"> | null;
};

export function toPublicAgentRun(run: AgentRun): PublicAgentRun {
  if (!run.wallet) return { ...run, wallet: null };
  const { privateKey: _pk, ...safe } = run.wallet;
  return { ...run, wallet: safe };
}
