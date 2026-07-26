import { store } from "@cipher/agent";
import { AuthError, requireAuthUserId } from "@/lib/auth";
import {
  chainFamilyForAddress,
  isEvmAddress,
  isSolanaAddress,
} from "@/lib/turnkey-wallets";

export async function GET() {
  try {
    const userId = await requireAuthUserId();
    return Response.json({ wallets: await store.listWallets(userId) });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "list_failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireAuthUserId();
    const body = await req.json();

    if (
      body.action === "connect_external" ||
      body.action === "upsert_turnkey"
    ) {
      const address = String(body.address ?? "");
      const chainFamily =
        (body.chainFamily === "evm" || body.chainFamily === "solana"
          ? body.chainFamily
          : null) ?? chainFamilyForAddress(address);

      if (
        !chainFamily ||
        (chainFamily === "evm" && !isEvmAddress(address)) ||
        (chainFamily === "solana" && !isSolanaAddress(address))
      ) {
        return Response.json({ error: "invalid_address" }, { status: 400 });
      }

      const source =
        body.action === "upsert_turnkey" ? "turnkey" : "external";
      const wallet = await store.upsertWallet(userId, {
        address,
        chainFamily,
        source,
        label: body.label ?? (source === "turnkey" ? "Cipher" : "Connected"),
        turnkeyWalletId: body.turnkeyWalletId
          ? String(body.turnkeyWalletId)
          : undefined,
      });
      return Response.json({ wallet });
    }

    if (body.action === "create_turnkey") {
      const { createCipherWallet } = await import("@cipher/turnkey");
      const created = await createCipherWallet("Cipher");
      const wallets = [];
      for (const account of created.accounts) {
        wallets.push(
          await store.upsertWallet(userId, {
            address: account.address,
            chainFamily: account.chainFamily,
            source: "turnkey",
            label: "Cipher",
            turnkeyWalletId: created.turnkeyWalletId,
          }),
        );
      }
      return Response.json({
        wallets,
        turnkeyWalletId: created.turnkeyWalletId,
      });
    }

    if (body.action === "prune_auto") {
      const result = await store.pruneAutoImported(userId);
      return Response.json(result);
    }

    if (body.action === "prune_all_external") {
      const result = await store.pruneAllExternal(userId);
      return Response.json(result);
    }

    if (body.action === "delete") {
      const walletId = body.walletId ? String(body.walletId) : "";
      const address = body.address ? String(body.address) : "";
      if (!walletId && !address) {
        return Response.json(
          { error: "walletId_or_address_required" },
          { status: 400 },
        );
      }
      if (walletId) {
        await store.deleteWallet(userId, walletId);
        return Response.json({ ok: true });
      }
      const result = await store.deleteWalletByAddress(userId, address, {
        externalOnly: body.externalOnly !== false,
      });
      return Response.json({ ok: true, ...result });
    }

    return Response.json({ error: "unknown_action" }, { status: 400 });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "wallet_failed" },
      { status: 500 },
    );
  }
}
