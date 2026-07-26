"use client";

import { AuthState, useTurnkey } from "@turnkey/react-wallet-kit";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { syncTurnkeyWalletsToCipher } from "@/lib/sync-wallets";
import { waitForCipherSession } from "@/lib/cipher-session";
import {
  addressFormatForChain,
  chainFamilyForAddress,
  type ChainFamily,
} from "@/lib/turnkey-wallets";
import { refreshWalletsThrottled } from "@/lib/turnkey-refresh";
import { cleanWalletName } from "@/lib/wallet-display";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function chainBadge(address: string) {
  const family = chainFamilyForAddress(address);
  if (family === "evm") return "EVM";
  if (family === "solana") return "SOL";
  return "?";
}

function friendlyTurnkeyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const cause =
    err && typeof err === "object" && "cause" in err
      ? String((err as { cause?: unknown }).cause)
      : "";
  if (/429|resource exhausted|too many requests/i.test(`${msg} ${cause}`)) {
    return "Turnkey is rate-limited. Wait about a minute, then try again.";
  }
  return msg || "Something went wrong";
}

type View = "list" | "create";

export function WalletModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    authState,
    session,
    wallets,
    walletProviders,
    createWallet,
    refreshWallets,
    handleConnectExternalWallet,
    disconnectWalletAccount,
  } = useTurnkey();
  const loggedIn = authState === AuthState.Authenticated && !!session;
  const [view, setView] = useState<View>("list");
  const [busy, setBusy] = useState<"create" | "connect" | "delete" | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [walletName, setWalletName] = useState("Cipher");
  const [chain, setChain] = useState<ChainFamily>("evm");
  // Hide Cipher modal while Turnkey's connect UI is open (otherwise it stacks on top)
  const [yieldToTurnkey, setYieldToTurnkey] = useState(false);

  useEffect(() => {
    if (!open) {
      setView("list");
      setError(null);
      setBusy(null);
      setDeletingId(null);
      setWalletName("Cipher");
      setChain("evm");
      setYieldToTurnkey(false);
    }
    // Intentionally no refreshWallets on open — Turnkey state is already loaded;
    // refetching here caused 429 Resource exhausted.
  }, [open]);

  if (!open || yieldToTurnkey) return null;

  async function afterWalletMutation(mode: "embedded" | "connected") {
    await waitForCipherSession(5_000);
    const list = await refreshWalletsThrottled(
      () => refreshWallets() as Promise<typeof wallets>,
      { force: true },
    );
    if (list.length) await syncTurnkeyWalletsToCipher(list, { mode });
  }

  async function onCreateEmbedded(e: FormEvent) {
    e.preventDefault();
    const name = walletName.trim();
    if (!name) {
      setError("Enter a wallet name");
      return;
    }
    setBusy("create");
    setError(null);
    try {
      await createWallet({
        walletName: name,
        accounts: [addressFormatForChain(chain)],
      });
      await afterWalletMutation("embedded");
      setView("list");
      setWalletName("Cipher");
      setChain("evm");
    } catch (err) {
      setError(friendlyTurnkeyError(err));
    } finally {
      setBusy(null);
    }
  }

  async function onConnectExternal() {
    setBusy("connect");
    setError(null);
    setYieldToTurnkey(true);
    try {
      await handleConnectExternalWallet({ successPageDuration: 800 });
      // Only persist wallets the user just connected — not every extension
      await afterWalletMutation("connected");
    } catch (err) {
      setError(friendlyTurnkeyError(err));
    } finally {
      setYieldToTurnkey(false);
      setBusy(null);
    }
  }

  async function onDeleteConnected(wallet: {
    walletId: string;
    accounts?: Array<{ address: string }>;
  }) {
    const addresses = (wallet.accounts ?? []).map((a) => a.address);
    if (addresses.length === 0) return;

    setBusy("delete");
    setDeletingId(wallet.walletId);
    setError(null);
    try {
      // Disconnect matching Turnkey providers (best-effort)
      for (const address of addresses) {
        const provider = walletProviders?.find((p) =>
          (p.connectedAddresses ?? []).some(
            (a) => a.toLowerCase() === address.toLowerCase(),
          ),
        );
        if (provider) {
          try {
            await disconnectWalletAccount(provider);
          } catch {
            // Still remove from Cipher even if provider disconnect fails
          }
        }
        await fetch("/api/wallets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "delete",
            address,
            externalOnly: true,
          }),
        });
      }
      await refreshWalletsThrottled(
        () => refreshWallets() as Promise<typeof wallets>,
        { force: true },
      );
    } catch (err) {
      setError(friendlyTurnkeyError(err));
    } finally {
      setBusy(null);
      setDeletingId(null);
    }
  }

  async function copy(addr: string) {
    await navigator.clipboard.writeText(addr);
    setCopied(addr);
    setTimeout(() => setCopied(null), 1500);
  }

  const embedded = wallets.filter((w) => String(w.source) === "embedded");
  const connected = wallets.filter((w) => String(w.source) === "connected");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center gap-2">
            {view === "create" ? (
              <button
                type="button"
                onClick={() => {
                  setView("list");
                  setError(null);
                }}
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                aria-label="Back"
              >
                <ArrowLeft className="size-4" />
              </button>
            ) : (
              <Wallet className="size-4 text-zinc-300" />
            )}
            <h2 className="text-sm font-medium text-zinc-100">
              {view === "create" ? "Create wallet" : "Wallets"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
          >
            <X className="size-4" />
          </button>
        </div>

        {view === "create" ? (
          <form
            onSubmit={(e) => void onCreateEmbedded(e)}
            className="flex flex-col gap-4 px-4 py-4"
          >
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-400">Name</span>
              <input
                value={walletName}
                onChange={(e) => setWalletName(e.target.value)}
                placeholder="e.g. Trading, Savings"
                autoFocus
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
              />
            </label>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-zinc-400">
                Chain
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      id: "evm" as const,
                      title: "EVM",
                      desc: "Ethereum, Base, …",
                    },
                    {
                      id: "solana" as const,
                      title: "Solana",
                      desc: "SOL & SPL tokens",
                    },
                  ] as const
                ).map((opt) => {
                  const selected = chain === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setChain(opt.id)}
                      className={
                        selected
                          ? "rounded-xl border border-zinc-100 bg-zinc-100 px-3 py-3 text-left text-zinc-950"
                          : "rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3 text-left text-zinc-300 hover:border-zinc-600"
                      }
                    >
                      <div className="text-sm font-medium">{opt.title}</div>
                      <div
                        className={
                          selected
                            ? "mt-0.5 text-[11px] text-zinc-600"
                            : "mt-0.5 text-[11px] text-zinc-500"
                        }
                      >
                        {opt.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={busy !== null || !walletName.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-100 px-3 py-2.5 text-sm font-medium text-zinc-950 hover:bg-white disabled:opacity-50"
            >
              {busy === "create" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Create {chain === "evm" ? "EVM" : "Solana"} wallet
            </button>
          </form>
        ) : (
          <>
            <div className="cipher-scroll max-h-[60vh] space-y-5 overflow-y-auto px-4 py-4">
              {!loggedIn ? (
                <p className="text-sm text-zinc-500">Log in to manage wallets.</p>
              ) : (
                <>
                  <section className="space-y-2">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Embedded (Turnkey)
                    </h3>
                    {embedded.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-zinc-800 px-3 py-4 text-sm text-zinc-500">
                        No embedded wallets yet. Create an EVM or Solana wallet
                        below.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {embedded.map((w) => (
                          <li
                            key={w.walletId}
                            className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3"
                          >
                            <div className="mb-2 text-sm font-medium text-zinc-100">
                              {cleanWalletName(w.walletName) ||
                                w.walletName ||
                                "Cipher"}
                            </div>
                            <ul className="space-y-1.5">
                              {(w.accounts ?? []).map((a) => (
                                <li
                                  key={a.address}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                                      {chainBadge(a.address)}
                                    </span>
                                    <span className="truncate font-mono text-xs text-zinc-400">
                                      {shortAddr(a.address)}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => void copy(a.address)}
                                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                                  >
                                    <Copy className="size-3" />
                                    {copied === a.address ? "Copied" : "Copy"}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Connected
                    </h3>
                    {connected.length === 0 ? (
                      <p className="text-sm text-zinc-600">None connected.</p>
                    ) : (
                      <ul className="space-y-2">
                        {connected.map((w) => {
                          const removing =
                            busy === "delete" && deletingId === w.walletId;
                          return (
                            <li
                              key={w.walletId}
                              className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3"
                            >
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-zinc-100">
                                  <ExternalLink className="size-3.5 shrink-0 text-zinc-500" />
                                  <span className="truncate">
                                    {cleanWalletName(w.walletName) ||
                                      w.walletName ||
                                      "Connected"}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  disabled={busy !== null}
                                  onClick={() => void onDeleteConnected(w)}
                                  aria-label={`Remove ${w.walletName || "connected wallet"}`}
                                  title="Remove connected wallet"
                                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-zinc-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                                >
                                  {removing ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="size-3.5" />
                                  )}
                                  Remove
                                </button>
                              </div>
                              {(w.accounts ?? []).map((a) => (
                                <div
                                  key={a.address}
                                  className="mt-1 flex items-center gap-2 font-mono text-xs text-zinc-400"
                                >
                                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-500">
                                    {chainBadge(a.address)}
                                  </span>
                                  {shortAddr(a.address)}
                                </div>
                              ))}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                </>
              )}
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>

            {loggedIn && (
              <div className="flex flex-col gap-2 border-t border-zinc-800 p-4">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    setError(null);
                    setView("create");
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-100 px-3 py-2.5 text-sm font-medium text-zinc-950 hover:bg-white disabled:opacity-50"
                >
                  <Plus className="size-4" />
                  Create wallet
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void onConnectExternal()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 py-2.5 text-sm font-medium text-zinc-100 hover:border-zinc-500 hover:bg-zinc-900 disabled:opacity-50"
                >
                  {busy === "connect" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Wallet className="size-4" />
                  )}
                  Connect wallet
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
