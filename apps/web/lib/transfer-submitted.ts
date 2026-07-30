import type { AgentLifiStatus } from "@ervo/adapters";

/**
 * Structured transfer outcome injected into chat for the agent.
 * After LI.FI watching finishes, `lifi` is the same object shape as get_lifi_status.
 */

export type TransferSubmittedPayload = {
  type: "transfer_submitted";
  planId: string;
  /** Source tx — also mirrored on lifi.txHash when present */
  txHash?: string;
  explorerUrl?: string;
  fromChainId: number;
  toChainId: number;
  route?: string;
  isCrossChain?: boolean;
  stepCount?: number;
  completedAllSteps?: boolean;
  /** Product brand — only set for LI.FI swap/bridge legs. */
  via?: string;
  /** Per-leg broadcast results (approve, lend, swap, …). */
  steps?: Array<{
    kind: string;
    label: string;
    txHash: string;
    explorerUrl?: string;
  }>;
  /**
   * Full LI.FI outcome — only for cross-chain LI.FI bridges.
   * Omit for Morpho / same-chain / non-LI.FI plans.
   */
  lifi?: AgentLifiStatus;
  /** @deprecated use lifi.terminalKind / lifi.status */
  success?: boolean;
  /** @deprecated use lifi.status */
  lifiStatus?: string;
  /** @deprecated use lifi.substatus */
  substatus?: string;
  /** @deprecated use lifi.substatusMessage */
  substatusMessage?: string;
  /** @deprecated use lifi.failReason */
  failReason?: string | null;
  /** @deprecated use lifi.receivingChainId */
  receivingChainId?: number | null;
  /** @deprecated use lifi.receivingTxHash */
  receivingTxHash?: string | null;
  /** @deprecated use lifi.lifiExplorerLink */
  lifiExplorerLink?: string | null;
  /** @deprecated prefer via */
  tool?: string;
};

const OPEN = "<ervo_transfer_submitted>";
const CLOSE = "</ervo_transfer_submitted>";

export function encodeTransferSubmitted(
  payload: Omit<TransferSubmittedPayload, "type">,
): string {
  const lifi = payload.lifi;
  // Never invent a Via brand for Morpho/etc. — LI.FI only when present.
  const via =
    payload.via === "LI.FI" || payload.tool === "LI.FI" || lifi
      ? "LI.FI"
      : payload.via;
  const body: TransferSubmittedPayload = {
    type: "transfer_submitted",
    ...payload,
    via,
    // Keep flat mirrors in sync for older UI / prompts while lifi is canonical.
    success:
      payload.success ??
      (lifi ? lifi.terminalKind === "success" : payload.completedAllSteps),
    lifiStatus: payload.lifiStatus ?? lifi?.status,
    substatus: payload.substatus ?? lifi?.substatus,
    substatusMessage: payload.substatusMessage ?? lifi?.substatusMessage,
    failReason: payload.failReason ?? lifi?.failReason ?? null,
    receivingChainId: payload.receivingChainId ?? lifi?.receivingChainId ?? null,
    receivingTxHash: payload.receivingTxHash ?? lifi?.receivingTxHash ?? null,
    lifiExplorerLink:
      payload.lifiExplorerLink ?? lifi?.lifiExplorerLink ?? null,
    tool: via === "LI.FI" ? "LI.FI" : payload.tool,
  };
  return `${OPEN}\n${JSON.stringify(body)}\n${CLOSE}`;
}

export function parseTransferSubmitted(
  text: string,
): TransferSubmittedPayload | null {
  const trimmed = text.trim();
  if (!trimmed.includes(OPEN)) return null;
  const start = trimmed.indexOf(OPEN) + OPEN.length;
  const end = trimmed.indexOf(CLOSE);
  if (end < start) return null;
  try {
    const raw = JSON.parse(trimmed.slice(start, end).trim()) as unknown;
    if (
      raw &&
      typeof raw === "object" &&
      (raw as { type?: string }).type === "transfer_submitted"
    ) {
      return raw as TransferSubmittedPayload;
    }
  } catch {
    return null;
  }
  return null;
}
