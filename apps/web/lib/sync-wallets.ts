"use client";

import { cleanWalletName } from "@cipher/core";
import { chainFamilyForAddress } from "@/lib/turnkey-wallets";

export const CIPHER_WALLETS_SYNCED_EVENT = "cipher:wallets-synced";

const lastSyncSigByMode: Record<string, string> = {};
let syncChain: Promise<void> = Promise.resolve();

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

function notifyWalletsSynced() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CIPHER_WALLETS_SYNCED_EVENT));
}

/**
 * Persist Turnkey wallets into Cipher Supabase for the agent/tools.
 * Default: embedded only — never auto-import browser extensions.
 * Use mode "connected" after the user explicitly clicks Connect.
 *
 * Syncs are queued (not dropped) so connect-after-login cannot lose Phantom.
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

  // Empty connected sync must not cache — refresh may have raced ahead of Phantom.
  if (mode === "connected" && filtered.length === 0) {
    return;
  }

  if (sig && sig === lastSyncSigByMode[mode]) return;

  const run = async () => {
    for (const wallet of filtered) {
      for (const account of wallet.accounts ?? []) {
        const address = account.address;
        const chainFamily = chainFamilyForAddress(address);
        if (!chainFamily) continue;
        const source =
          String(wallet.source) === "embedded" ? "turnkey" : "external";
        const res = await fetch("/api/wallets", {
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
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.error("wallet upsert failed", address, body);
        }
      }
    }
    lastSyncSigByMode[mode] = sig;
    notifyWalletsSynced();
  };

  const next = syncChain.then(run, run);
  syncChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** Test / logout helper */
export function resetWalletSyncState() {
  for (const k of Object.keys(lastSyncSigByMode)) delete lastSyncSigByMode[k];
  syncChain = Promise.resolve();
}
