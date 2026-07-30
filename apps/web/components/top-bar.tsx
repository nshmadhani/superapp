"use client";

import { AuthState, useTurnkey } from "@turnkey/react-wallet-kit";
import { ChevronDown, LogOut, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ERVO_AUTHED_EVENT } from "./auth-sync";
import { waitForErvoSession } from "@/lib/ervo-session";
import { WalletModal } from "./wallet-modal";

type ErvoUser = {
  id: string;
  email: string | null;
};

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function TopBar() {
  const { authState, handleLogin, logout, user, session, wallets } =
    useTurnkey();
  const [ervoUser, setErvoUser] = useState<ErvoUser | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const loggedIn = authState === AuthState.Authenticated && !!session;

  const primaryAddress = useMemo(() => {
    const embedded = wallets.find((w) => String(w.source) === "embedded");
    const any = embedded ?? wallets[0];
    return any?.accounts?.[0]?.address ?? null;
  }, [wallets]);

  async function refreshMe() {
    const res = await fetch("/api/auth/me");
    const d = await res.json();
    setErvoUser(d.user ?? null);
  }

  useEffect(() => {
    if (!loggedIn) {
      setErvoUser(null);
      return;
    }
    void waitForErvoSession().then((ok) => {
      if (ok) void refreshMe();
    });
    const onAuthed = () => void refreshMe();
    window.addEventListener(ERVO_AUTHED_EVENT, onAuthed);
    return () => window.removeEventListener(ERVO_AUTHED_EVENT, onAuthed);
  }, [loggedIn, user?.userId]);

  async function onLogout() {
    try {
      await logout();
    } catch {
      /* ignore */
    }
    await fetch("/api/auth/logout", { method: "POST" });
    setErvoUser(null);
    window.location.href = "/";
  }

  return (
    <>
      <header className="flex h-12 items-center justify-end gap-2 border-b border-zinc-800 bg-zinc-950/80 px-3 backdrop-blur">
        {!loggedIn ? (
          <button
            type="button"
            onClick={() => void handleLogin()}
            className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-white"
          >
            Log in
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setWalletOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-sm text-zinc-100 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
            >
              <Wallet className="size-3.5 text-zinc-400" />
              <span className="font-mono text-xs">
                {primaryAddress ? shortAddr(primaryAddress) : "Wallets"}
              </span>
              <ChevronDown className="size-3.5 text-zinc-500" />
            </button>
            <div className="ml-1 flex items-center gap-2 border-l border-zinc-800 pl-3">
              <span className="max-w-[140px] truncate text-xs text-zinc-500">
                {ervoUser?.email || user?.userEmail || "Account"}
              </span>
              <button
                type="button"
                onClick={() => void onLogout()}
                aria-label="Log out"
                title="Log out"
                className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          </>
        )}
      </header>
      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </>
  );
}
