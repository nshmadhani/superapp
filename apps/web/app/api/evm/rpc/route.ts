import { AuthError, requireAuthUserId } from "@/lib/auth";
import { resolveEvmRpcUrl, supportedEvmChainIds } from "@cipher/rpc";

type RpcBody = {
  chainId?: number;
  method?: string;
  params?: unknown[];
};

const ALLOWED_METHODS = new Set([
  "eth_chainId",
  "eth_blockNumber",
  "eth_getBlockByNumber",
  "eth_getTransactionCount",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "eth_call",
  "eth_sendRawTransaction",
]);

/**
 * Authenticated EVM JSON-RPC proxy.
 * Keeps QuickNode tokens server-side; client only signs with Turnkey.
 */
export async function POST(req: Request) {
  try {
    await requireAuthUserId();
    const body = (await req.json()) as RpcBody;
    const chainId = Number(body.chainId);
    const method = body.method?.trim();
    const params = Array.isArray(body.params) ? body.params : [];

    if (!Number.isFinite(chainId) || !supportedEvmChainIds().includes(chainId)) {
      return Response.json({ error: "unsupported_chain" }, { status: 400 });
    }
    if (!method || !ALLOWED_METHODS.has(method)) {
      return Response.json({ error: "method_not_allowed" }, { status: 400 });
    }

    const rpcUrl = resolveEvmRpcUrl(chainId);
    const upstream = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    });

    const json = (await upstream.json()) as {
      result?: unknown;
      error?: { message?: string; code?: number };
    };

    if (json.error) {
      return Response.json(
        {
          error: json.error.message ?? "rpc_error",
          code: json.error.code,
        },
        { status: 502 },
      );
    }

    return Response.json({ result: json.result });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "rpc_proxy_failed" },
      { status: 500 },
    );
  }
}
