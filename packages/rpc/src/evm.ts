import { createPublicClient, http, type Chain } from "viem";
import { mainnet, base, arbitrum } from "viem/chains";

const chains: Record<number, Chain> = {
  1: mainnet,
  8453: base,
  42161: arbitrum,
};

/** QuickNode network slug for named endpoints: {name}.{network}.quiknode.pro/{token} */
const quickNodeNetwork: Record<number, string> = {
  1: "ethereum-mainnet",
  8453: "base-mainnet",
  42161: "arbitrum-mainnet",
};

export function getQuickNodeHttpUrl(
  chainId: number,
  endpointName: string,
  apiToken: string,
): string {
  const network = quickNodeNetwork[chainId];
  if (!network) throw new Error(`Unsupported chainId ${chainId}`);
  return `https://${endpointName}.${network}.quiknode.pro/${apiToken}`;
}

/** @deprecated use getQuickNodeHttpUrl */
export function getAlchemyHttpUrl(chainId: number, apiKey: string): string {
  return getQuickNodeHttpUrl(chainId, "unused", apiKey);
}

export function getEvmPublicClient(
  chainId: number,
  env: NodeJS.ProcessEnv = process.env,
) {
  const endpointName = env.QUICKNODE_ENDPOINT_NAME;
  const apiToken = env.QUICKNODE_API_TOKEN;
  if (!endpointName || !apiToken) {
    throw new Error("Missing QUICKNODE_ENDPOINT_NAME or QUICKNODE_API_TOKEN");
  }
  const chain = chains[chainId];
  if (!chain) throw new Error(`Unsupported chainId ${chainId}`);
  return createPublicClient({
    chain,
    transport: http(getQuickNodeHttpUrl(chainId, endpointName, apiToken)),
  });
}
