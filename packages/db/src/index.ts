export { createDb, hasSupabaseEnv } from "./client";
export type { SupabaseClient } from "@supabase/supabase-js";
export {
  savePlan,
  createConfirm,
  approveConfirm,
  consumeConfirm,
  rejectConfirm,
  getPlan,
} from "./plans";
export {
  listWallets,
  upsertExternalWallet,
  pruneAutoImportedWallets,
  pruneAllExternalWallets,
  deleteWallet,
  deleteWalletByAddress,
  ensureUser,
} from "./wallets";
export {
  saveAgentWallet,
  getAgentWalletForRun,
  getAgentWalletPrivateKey,
  markAgentWalletDestroyed,
  type AgentWalletRow,
} from "./agent-wallets";
export {
  upsertAgentRun,
  getAgentRun,
  listAgentRuns,
  listActiveAgentRuns,
  patchAgentRun,
  type PersistedAgentRun,
  type PersistedAgentWallet,
} from "./agent-runs";
export { encryptPrivateKey, decryptPrivateKey } from "./crypto";
export {
  getPortfolioCache,
  upsertPortfolioCache,
  deletePortfolioCache,
  deletePortfolioCacheByAddress,
  portfolioCacheAvailable,
  type PortfolioCacheRow,
} from "./portfolio-cache";
