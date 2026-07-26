export type ChainRef = { chainId: number } | { cluster: "solana-mainnet" };

export type WalletRef = {
  id: string;
  address: string;
  chainFamily: "evm" | "solana";
  source: "external" | "turnkey";
  label?: string;
};

export type { Plan, PlanStep, PlanUnsignedTx, ConfirmToken } from "./plan";

export { hashPlan } from "./plan";
export { cleanWalletName, walletDisplayName } from "./wallet-name";
export {
  LIFI_SOLANA_CHAIN_ID,
  isLifiSolanaChain,
  isLifiEvmChain,
  chainFamilyForLifiChain,
  defaultLifiChainForFamily,
} from "./lifi-chains";
