import { getStatus, type StatusResponse } from "@lifi/sdk";
import { createLifiClient } from "./client";

export type LifiStatusRequest = {
  txHash: string;
  fromChain?: number;
  toChain?: number;
  bridge?: string;
};

export async function getLifiStatus(
  req: LifiStatusRequest,
): Promise<StatusResponse> {
  const client = createLifiClient();
  return getStatus(client, {
    txHash: req.txHash,
    fromChain: req.fromChain,
    toChain: req.toChain,
    bridge: req.bridge,
  });
}
