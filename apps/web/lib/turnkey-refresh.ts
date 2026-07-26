"use client";

type WalletLike = {
  walletId: string;
  walletName?: string | null;
  source: string;
  accounts?: Array<{ address: string }>;
};

const COOLDOWN_MS = 45_000;

let inFlight: Promise<WalletLike[]> | null = null;
let lastOkAt = 0;
let lastWallets: WalletLike[] = [];
let rateLimitedUntil = 0;

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const cause =
    err && typeof err === "object" && "cause" in err
      ? String((err as { cause?: unknown }).cause)
      : "";
  return (
    /429|resource exhausted|too many requests|rate.?limit/i.test(msg) ||
    /429|resource exhausted|too many requests/i.test(cause)
  );
}

/**
 * Deduped + cooled-down Turnkey wallet refresh.
 * Avoids hammering list_wallets / list_wallet_accounts (Turnkey 429s).
 */
export async function refreshWalletsThrottled(
  refreshWallets: () => Promise<WalletLike[]>,
  opts?: { force?: boolean },
): Promise<WalletLike[]> {
  const now = Date.now();
  if (now < rateLimitedUntil && !opts?.force) {
    return lastWallets;
  }
  if (!opts?.force && lastOkAt && now - lastOkAt < COOLDOWN_MS) {
    return lastWallets;
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const list = await refreshWallets();
      lastWallets = list ?? [];
      lastOkAt = Date.now();
      return lastWallets;
    } catch (err) {
      if (isRateLimitError(err)) {
        rateLimitedUntil = Date.now() + 60_000;
        console.warn(
          "Turnkey rate limited — using cached wallets for 60s",
          err,
        );
        return lastWallets;
      }
      throw err;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function getCachedTurnkeyWallets(): WalletLike[] {
  return lastWallets;
}

export function rememberTurnkeyWallets(wallets: WalletLike[]) {
  lastWallets = wallets;
  lastOkAt = Date.now();
}
