/** Structured transfer outcome injected into chat for the agent (not a normal user message). */

export type TransferSubmittedPayload = {
  type: "transfer_submitted";
  planId: string;
  txHash?: string;
  explorerUrl?: string;
  fromChainId: number;
  toChainId: number;
  route?: string;
  tool?: string;
  isCrossChain?: boolean;
};

const OPEN = "<cipher_transfer_submitted>";
const CLOSE = "</cipher_transfer_submitted>";

export function encodeTransferSubmitted(
  payload: Omit<TransferSubmittedPayload, "type">,
): string {
  const body: TransferSubmittedPayload = {
    type: "transfer_submitted",
    ...payload,
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
