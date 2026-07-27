import { getStatus, type StatusResponse } from "@lifi/sdk";
import { createLifiClient } from "./client";
import { normalizeLifiTerminal } from "./status-normalize";

export type LifiStatusRequest = {
  txHash: string;
  fromChain?: number;
  toChain?: number;
  bridge?: string;
};

export type LifiStatusResult = StatusResponse & {
  terminalKind?: string;
  uiStatus?: string;
  /** LI.FI raw status before terminal normalization */
  rawStatus?: string;
  substatus?: string;
  substatusMessage?: string;
  /** Bridge/DEX tool id (e.g. relaydepository) */
  tool?: string;
  /** Relay (or other) fail reason when known, e.g. SLIPPAGE */
  failReason?: string | null;
  receivingChainId?: number | null;
  sendingChainId?: number | null;
  receivingTxHash?: string | null;
  sendingTxHash?: string | null;
  lifiExplorerLink?: string | null;
};

async function fetchRelayFailReason(
  txHash: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.relay.link/requests/v2?hash=${encodeURIComponent(txHash)}`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      requests?: Array<{ data?: { failReason?: string } }>;
    };
    const reason = body.requests?.[0]?.data?.failReason;
    return reason ? String(reason) : null;
  } catch {
    return null;
  }
}

export async function getLifiStatus(
  req: LifiStatusRequest,
): Promise<LifiStatusResult> {
  const client = createLifiClient();
  const status = await getStatus(client, {
    txHash: req.txHash,
    fromChain: req.fromChain,
    toChain: req.toChain,
    bridge: req.bridge,
  });
  const raw = status as StatusResponse & {
    substatus?: string;
    substatusMessage?: string;
    status?: string;
    tool?: string;
    lifiExplorerLink?: string;
    sending?: { chainId?: number; txHash?: string };
    receiving?: { chainId?: number; txHash?: string };
  };
  const terminal = normalizeLifiTerminal({
    status: raw.status,
    substatus: raw.substatus,
  });

  let failReason: string | null = null;
  const tool = raw.tool ?? req.bridge;
  if (
    terminal.kind === "refunded" ||
    terminal.kind === "failed" ||
    /relay/i.test(String(tool ?? ""))
  ) {
    failReason = await fetchRelayFailReason(req.txHash);
  }

  return {
    ...status,
    // Prefer the real outcome for clients that only read `status`.
    status: terminal.uiStatus as StatusResponse["status"],
    rawStatus: raw.status,
    substatus: raw.substatus,
    substatusMessage: raw.substatusMessage,
    tool,
    terminalKind: terminal.kind,
    uiStatus: terminal.uiStatus,
    failReason,
    sendingChainId: raw.sending?.chainId ?? null,
    receivingChainId: raw.receiving?.chainId ?? null,
    sendingTxHash: raw.sending?.txHash ?? req.txHash,
    receivingTxHash: raw.receiving?.txHash ?? null,
    lifiExplorerLink: raw.lifiExplorerLink ?? undefined,
  } as LifiStatusResult;
}
