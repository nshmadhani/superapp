import { tool } from "ai";
import { z } from "zod";
import { buildAgentLifiStatus, getLifiStatus } from "@cipher/adapters";

/**
 * Agent-facing LI.FI status — includes terminalKind, substatus, and Relay
 * failReason (e.g. SLIPPAGE) when a bridge refunded.
 * Same shape is injected into chat after the UI finishes watching a transfer.
 */
export function getLifiStatusTool() {
  return tool({
    description:
      "Fetch full LI.FI transfer status for a source tx hash. Returns type=lifi_status (status, terminalKind, substatus, failReason, receiving chain, guidance). The UI injects this same object after watching a bridge — use that payload when present; call this tool to refresh or when the user asks why a transfer refunded.",
    inputSchema: z.object({
      txHash: z.string().describe("Source-chain transaction hash"),
      fromChainId: z
        .number()
        .int()
        .optional()
        .describe("LI.FI source chain id (e.g. 999 HyperEVM)"),
      toChainId: z
        .number()
        .int()
        .optional()
        .describe("Requested destination chain id (e.g. 8453 Base)"),
      bridge: z
        .string()
        .optional()
        .describe("Optional LI.FI tool id from the plan (e.g. relaydepository)"),
    }),
    execute: async (input) => {
      try {
        const status = await getLifiStatus({
          txHash: input.txHash,
          fromChain: input.fromChainId,
          toChain: input.toChainId,
          bridge: input.bridge,
        });
        return buildAgentLifiStatus({
          txHash: input.txHash,
          status: status.uiStatus ?? String(status.status),
          uiStatus: status.uiStatus,
          rawStatus: status.rawStatus,
          substatus: status.substatus,
          substatusMessage: status.substatusMessage,
          terminalKind: status.terminalKind,
          tool: status.tool,
          failReason: status.failReason,
          sendingChainId: status.sendingChainId,
          receivingChainId: status.receivingChainId,
          sendingTxHash: status.sendingTxHash,
          receivingTxHash: status.receivingTxHash,
          lifiExplorerLink: status.lifiExplorerLink,
        });
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "lifi_status_failed",
        };
      }
    },
  });
}
