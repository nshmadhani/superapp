import { AuthError, requireAuthUserId } from "@/lib/auth";
import { getLifiStatus } from "@cipher/adapters";

/** Server-only LiFi status poll — keeps LIFI_API_KEY off the client. */
export async function GET(req: Request) {
  try {
    await requireAuthUserId();
    const { searchParams } = new URL(req.url);
    const txHash = searchParams.get("txHash");
    if (!txHash) {
      return Response.json({ error: "txHash_required" }, { status: 400 });
    }
    const fromChain = searchParams.get("fromChain");
    const toChain = searchParams.get("toChain");
    const bridge = searchParams.get("bridge") ?? undefined;

    const status = await getLifiStatus({
      txHash,
      fromChain: fromChain ? Number(fromChain) : undefined,
      toChain: toChain ? Number(toChain) : undefined,
      bridge,
    });
    return Response.json(status);
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "status_failed" },
      { status: 500 },
    );
  }
}
