"use client";

import { useTurnkey, AuthState } from "@turnkey/react-wallet-kit";
import { useEffect, useRef } from "react";
import { syncTurnkeyWalletsToCipher } from "@/lib/sync-wallets";
import { rememberTurnkeyWallets } from "@/lib/turnkey-refresh";

export const CIPHER_AUTHED_EVENT = "cipher:authed";
export const CIPHER_LOGOUT_EVENT = "cipher:logout";

/** Drop auto-imported Browser wallets / EVM case-dupes. Never wipe labeled Connect wallets. */
async function cleanupStaleExternalWallets() {
  try {
    await fetch("/api/wallets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "prune_auto" }),
    });
  } catch {
    // non-fatal
  }
}

/**
 * When Turnkey authenticates: upsert Cipher user in Supabase, then sync wallets.
 * Wallet sync waits for auth cookie so /api/wallets never 401s on race.
 */
export function AuthSync() {
  const { authState, session, user, wallets } = useTurnkey();
  const syncedAuthKey = useRef<string | null>(null);
  const syncedWalletSig = useRef<string | null>(null);
  const authReady = useRef(false);
  const pendingWallets = useRef<typeof wallets | null>(null);

  useEffect(() => {
    if (authState !== AuthState.Authenticated || !session || !user) {
      if (authState === AuthState.Unauthenticated) {
        syncedAuthKey.current = null;
        syncedWalletSig.current = null;
        authReady.current = false;
        pendingWallets.current = null;
      }
      return;
    }

    const turnkeyUserId = user.userId;
    const turnkeySuborgId = session.organizationId;
    if (!turnkeyUserId || !turnkeySuborgId) return;

    const key = `${turnkeyUserId}:${turnkeySuborgId}`;
    if (syncedAuthKey.current === key) return;
    syncedAuthKey.current = key;
    authReady.current = false;

    const email =
      user.userEmail ||
      (user as { email?: string }).email ||
      null;

    void (async () => {
      try {
        const res = await fetch("/api/auth/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            turnkeyUserId,
            turnkeySuborgId,
            email,
          }),
        });
        if (!res.ok) {
          console.error("auth sync failed", await res.text());
          syncedAuthKey.current = null;
          return;
        }

        // Confirm cipher_user_id cookie stuck before any authenticated API calls.
        const me = await fetch("/api/auth/me");
        const meBody = me.ok ? await me.json() : null;
        if (!meBody?.user?.id) {
          console.error("auth sync ok but session cookie missing");
          syncedAuthKey.current = null;
          return;
        }

        authReady.current = true;

        const queued = pendingWallets.current;
        if (queued?.length) {
          pendingWallets.current = null;
          const embedded = queued.filter(
            (w) => String(w.source) === "embedded",
          );
          const sig = embedded
            .map(
              (w) =>
                `${w.walletId}:${(w.accounts ?? []).map((a) => a.address).join(",")}`,
            )
            .join("|");
          syncedWalletSig.current = sig;
          rememberTurnkeyWallets(queued);
          await cleanupStaleExternalWallets();
          await syncTurnkeyWalletsToCipher(queued, { mode: "embedded" }).catch(
            (err) => console.error("cipher wallet sync failed", err),
          );
        } else {
          await cleanupStaleExternalWallets();
        }

        window.dispatchEvent(new CustomEvent(CIPHER_AUTHED_EVENT));
      } catch (err) {
        console.error("auth sync failed", err);
        syncedAuthKey.current = null;
      }
    })();
  }, [authState, session, user]);

  // Persist embedded Turnkey wallets only (never auto-import extensions)
  useEffect(() => {
    if (authState !== AuthState.Authenticated) return;
    if (!wallets?.length) return;

    const embedded = wallets.filter((w) => String(w.source) === "embedded");
    const sig = embedded
      .map(
        (w) =>
          `${w.walletId}:${(w.accounts ?? []).map((a) => a.address).join(",")}`,
      )
      .join("|");
    if (syncedWalletSig.current === sig) return;

    if (!authReady.current) {
      pendingWallets.current = wallets;
      return;
    }

    syncedWalletSig.current = sig;
    rememberTurnkeyWallets(wallets);

    void (async () => {
      await cleanupStaleExternalWallets();
      await syncTurnkeyWalletsToCipher(wallets, { mode: "embedded" }).catch(
        (err) => console.error("cipher wallet sync failed", err),
      );
    })();
  }, [authState, wallets]);

  return null;
}
