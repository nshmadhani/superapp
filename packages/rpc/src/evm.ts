import { createPublicClient, http, type Chain, defineChain } from "viem";
import { mainnet, base, arbitrum } from "viem/chains";

export const hyperEvm = defineChain({
  id: 999,
  name: "HyperEVM",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.hyperliquid.xyz/evm"],
    },
  },
  blockExplorers: {
    default: { name: "HyperEVMScan", url: "https://hyperevmscan.io" },
  },
});

const chains: Record<number, Chain> = {
  1: mainnet,
  8453: base,
  42161: arbitrum,
  999: hyperEvm,
};

/**
 * QuickNode network slug / path for named endpoints:
 *   {name}.{network}.quiknode.pro/{token}{suffix}
 */
const quickNodeNetwork: Record<
  number,
  { network: string; pathSuffix?: string }
> = {
  1: { network: "ethereum-mainnet" },
  8453: { network: "base-mainnet" },
  42161: { network: "arbitrum-mainnet" },
  // HyperEVM QuickNode exposes JSON-RPC under /evm
  999: { network: "hype-mainnet", pathSuffix: "/evm" },
};

export function getQuickNodeHttpUrl(
  chainId: number,
  endpointName: string,
  apiToken: string,
): string {
  const entry = quickNodeNetwork[chainId];
  if (!entry) throw new Error(`Unsupported chainId ${chainId}`);
  const suffix = entry.pathSuffix ?? "";
  return `https://${endpointName}.${entry.network}.quiknode.pro/${apiToken}${suffix}`;
}

/** @deprecated use getQuickNodeHttpUrl */
export function getAlchemyHttpUrl(chainId: string | number, apiKey: string): string {
  return getQuickNodeHttpUrl(Number(chainId), "unused", apiKey);
}

/**
 * Resolve an HTTP RPC URL for a chain.
 * Prefers chain-specific env overrides, then QuickNode name+token.
 */
export function resolveEvmRpcUrl(
  chainId: number,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const overrides: Record<number, string | undefined> = {
    1: env.ETHEREUM_RPC_URL || env.NEXT_PUBLIC_ETHEREUM_RPC_URL,
    8453: env.BASE_RPC_URL || env.NEXT_PUBLIC_BASE_RPC_URL,
    42161: env.ARBITRUM_RPC_URL || env.NEXT_PUBLIC_ARBITRUM_RPC_URL,
    999: env.HYPEREVM_RPC_URL || env.NEXT_PUBLIC_HYPEREVM_RPC_URL,
  };
  const override = overrides[chainId]?.trim();
  if (override) return override;

  const endpointName = env.QUICKNODE_ENDPOINT_NAME?.trim();
  const apiToken = env.QUICKNODE_API_TOKEN?.trim();
  if (!endpointName || !apiToken) {
    throw new Error(
      `Missing RPC for chain ${chainId}: set QUICKNODE_ENDPOINT_NAME/QUICKNODE_API_TOKEN or a chain RPC URL`,
    );
  }
  return getQuickNodeHttpUrl(chainId, endpointName, apiToken);
}

export function getEvmPublicClient(
  chainId: number,
  env: NodeJS.ProcessEnv = process.env,
) {
  const chain = chains[chainId];
  if (!chain) throw new Error(`Unsupported chainId ${chainId}`);
  return createPublicClient({
    chain,
    transport: http(resolveEvmRpcUrl(chainId, env)),
  });
}

export function supportedEvmChainIds(): number[] {
  return Object.keys(chains).map(Number);
}
