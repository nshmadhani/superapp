"use client";

import { cleanWalletName } from "@cipher/core";
import { chainFamilyForAddress } from "@/lib/turnkey-wallets";

let lastSyncSig = "";
let syncInFlight: Promise<void> | null = null;

export type SyncWalletsMode = "embedded" | "connected" | "all";

type TurnkeyWalletLike = {
  walletId: string;
  walletName?: string | null;
  source: string;
  accounts?: Array<{ address: string }>;
};

function labelForWallet(
  wallet: TurnkeyWalletLike,
  source: "turnkey" | "external",
): string {
  const cleaned = cleanWalletName(wallet.walletName);
  if (cleaned) return cleaned;
  return source === "turnkey" ? "Ervo" : "Connected";
}

/**
 * Persist Turnkey wallets into Ervo Supabase for the agent/tools.
 * Default: embedded only — never auto-import browser extensions.
 * Use mode "connected" after the user explicitly clicks Connect.
 */
export async function syncTurnkeyWalletsToCipher(
  wallets: TurnkeyWalletLike[],
  opts: { mode?: SyncWalletsMode } = {},
) {
  const mode = opts.mode ?? "embedded";
  const filtered = wallets.filter((w) => {
    const source = String(w.source);
    if (mode === "embedded") return source === "embedded";
    if (mode === "connected") return source === "connected";
    return true;
  });

  const sig = `${mode}:${filtered
    .map(
      (w) =>
        `${w.walletId}:${(w.accounts ?? []).map((a) => a.address).join(",")}`,
    )
    .join("|")}`;
  if (sig && sig === lastSyncSig) return;
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    try {
      for (const wallet of filtered) {
        for (const account of wallet.accounts ?? []) {
          const address = account.address;
          const chainFamily = chainFamilyForAddress(address);
          if (!chainFamily) continue;
          const source =
            String(wallet.source) === "embedded" ? "turnkey" : "external";
          await fetch("/api/wallets", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action:
                source === "turnkey" ? "upsert_turnkey" : "connect_external",
              address,
              chainFamily,
              label: labelForWallet(wallet, source),
              turnkeyWalletId: wallet.walletId,
            }),
          });
        }
      }
      lastSyncSig = sig;
    } finally {
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}
