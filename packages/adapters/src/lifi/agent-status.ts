/**
 * Canonical agent-facing LI.FI status shape.
 * Used by get_lifi_status AND by transfer_submitted after the UI finishes watching.
 */
export type AgentLifiStatus = {
  type: "lifi_status";
  txHash: string;
  status: string;
  rawStatus?: string;
  substatus?: string;
  substatusMessage?: string;
  terminalKind: string;
  tool?: string;
  failReason?: string | null;
  sendingChainId?: number | null;
  receivingChainId?: number | null;
  sendingTxHash?: string | null;
  receivingTxHash?: string | null;
  lifiExplorerLink?: string | null;
  guidance?: string;
};

export type LifiStatusFields = {
  txHash: string;
  status?: string | null;
  uiStatus?: string | null;
  rawStatus?: string | null;
  substatus?: string | null;
  substatusMessage?: string | null;
  terminalKind?: string | null;
  tool?: string | null;
  failReason?: string | null;
  sendingChainId?: number | null;
  receivingChainId?: number | null;
  sendingTxHash?: string | null;
  receivingTxHash?: string | null;
  lifiExplorerLink?: string | null;
};

export function guidanceForLifiStatus(opts: {
  terminalKind: string;
  failReason?: string | null;
}): string | undefined {
  const kind = opts.terminalKind;
  const fail = opts.failReason;
  if (kind === "refunded" && fail === "SLIPPAGE") {
    return "Bridge refunded due to slippage. For small USD amounts (gas top-ups ~$1–25) re-quote with higher slippage (create_plan slippage 0.03–0.05) or a larger amount, then retry.";
  }
  if (kind === "refunded") {
    return "Bridge refunded on the source chain — funds should be back (minus fees). Inspect failReason; do not tell the user destination funds arrived.";
  }
  if (kind === "failed") {
    return "Transfer failed. Do not claim destination funds arrived; check failReason / substatus and get_portfolio before retrying.";
  }
  if (kind === "success") {
    return "Transfer completed to the destination chain. Confirm balances with get_portfolio before the next on-chain step.";
  }
  if (kind === "partial") {
    return "Transfer only partially completed. Check receiving amounts via get_portfolio before acting further.";
  }
  if (kind === "pending") {
    return "Transfer still pending on LI.FI. Poll get_lifi_status again; do not assume destination funds arrived.";
  }
  return undefined;
}

/** Map adapter/API status fields → agent lifi_status object. */
export function buildAgentLifiStatus(
  fields: LifiStatusFields,
): AgentLifiStatus {
  const terminalKind = fields.terminalKind ?? "unknown";
  const status = String(
    fields.uiStatus ?? fields.status ?? "unknown",
  ).toUpperCase();
  return {
    type: "lifi_status",
    txHash: fields.txHash,
    status,
    rawStatus: fields.rawStatus ?? undefined,
    substatus: fields.substatus ?? undefined,
    substatusMessage: fields.substatusMessage ?? undefined,
    terminalKind,
    tool: fields.tool ?? undefined,
    failReason: fields.failReason ?? null,
    sendingChainId: fields.sendingChainId ?? null,
    receivingChainId: fields.receivingChainId ?? null,
    sendingTxHash: fields.sendingTxHash ?? fields.txHash,
    receivingTxHash: fields.receivingTxHash ?? null,
    lifiExplorerLink: fields.lifiExplorerLink ?? null,
    guidance: guidanceForLifiStatus({
      terminalKind,
      failReason: fields.failReason,
    }),
  };
}
