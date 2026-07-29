"use client";

import {
  setConnectedExternal,
  type ConnectedExternal,
} from "@/lib/connected-externals";
import { chainFamilyForAddress } from "@/lib/turnkey-wallets";
import { CIPHER_WALLETS_SYNCED_EVENT } from "@/lib/sync-wallets";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void;
  isMetaMask?: boolean;
  providers?: Eip1193[];
};

type SolanaProvider = {
  publicKey?: { toBase58(): string } | null;
  isPhantom?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{
    publicKey: { toBase58(): string };
  }>;
  disconnect?: () => Promise<void>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void;
};

type InjectedWindow = Window & {
  ethereum?: Eip1193;
  solana?: SolanaProvider;
  phantom?: { solana?: SolanaProvider };
};

function injectedWindow(): InjectedWindow | null {
  if (typeof window === "undefined") return null;
  return window as InjectedWindow;
}

export type ExternalProviderOption = {
  id: ConnectedExternal["providerId"];
  label: string;
  chainFamily: "evm" | "solana";
  available: boolean;
};

function getEvmProvider(): Eip1193 | null {
  const win = injectedWindow();
  const eth = win?.ethereum;
  if (!eth) return null;
  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    return eth.providers[0] ?? eth;
  }
  return eth;
}

function getSolanaProvider(): SolanaProvider | null {
  const win = injectedWindow();
  if (!win) return null;
  return win.phantom?.solana ?? win.solana ?? null;
}

export function listExternalProviderOptions(): ExternalProviderOption[] {
  const win = injectedWindow();
  const evm = getEvmProvider();
  const sol = getSolanaProvider();
  return [
    {
      id: "injected-evm",
      label: win?.ethereum?.isMetaMask ? "MetaMask" : "Browser EVM wallet",
      chainFamily: "evm",
      available: Boolean(evm),
    },
    {
      id: "phantom-solana",
      label: "Phantom",
      chainFamily: "solana",
      available: Boolean(sol),
    },
  ];
}

async function persistExternal(entry: ConnectedExternal) {
  const res = await fetch("/api/wallets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "connect_external",
      address: entry.address,
      chainFamily: entry.chainFamily,
      label: entry.label,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      typeof body.error === "string" ? body.error : "Failed to link wallet",
    );
  }
  window.dispatchEvent(new CustomEvent(CIPHER_WALLETS_SYNCED_EVENT));
}

export async function connectInjectedEvm(): Promise<ConnectedExternal> {
  const provider = getEvmProvider();
  if (!provider) {
    throw new Error("No EVM browser wallet found (install MetaMask or similar).");
  }
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  const address = accounts[0];
  if (!address || !chainFamilyForAddress(address)) {
    throw new Error("No EVM account returned from wallet.");
  }
  const entry: ConnectedExternal = {
    address: address.toLowerCase(),
    chainFamily: "evm",
    label: injectedWindow()?.ethereum?.isMetaMask
      ? "MetaMask"
      : "Browser wallet",
    providerId: "injected-evm",
  };
  setConnectedExternal(entry);
  await persistExternal(entry);
  return entry;
}

export async function connectPhantomSolana(): Promise<ConnectedExternal> {
  const provider = getSolanaProvider();
  if (!provider) {
    throw new Error("Phantom (or Solana wallet) not found.");
  }
  const { publicKey } = await provider.connect();
  const address = publicKey.toBase58();
  if (!chainFamilyForAddress(address)) {
    throw new Error("Invalid Solana address from wallet.");
  }
  const entry: ConnectedExternal = {
    address,
    chainFamily: "solana",
    label: provider.isPhantom ? "Phantom" : "Solana wallet",
    providerId: "phantom-solana",
  };
  setConnectedExternal(entry);
  await persistExternal(entry);
  return entry;
}

export async function connectExternalProvider(
  id: ConnectedExternal["providerId"],
): Promise<ConnectedExternal> {
  if (id === "injected-evm") return connectInjectedEvm();
  return connectPhantomSolana();
}

/** Soft-reconnect: read current accounts without forcing a new prompt when possible. */
export async function refreshLiveExternalConnections() {
  const evm = getEvmProvider();
  if (evm) {
    try {
      const accounts = (await evm.request({ method: "eth_accounts" })) as string[];
      const address = accounts[0];
      if (address && chainFamilyForAddress(address)) {
        setConnectedExternal({
          address: address.toLowerCase(),
          chainFamily: "evm",
          label: injectedWindow()?.ethereum?.isMetaMask
            ? "MetaMask"
            : "Browser wallet",
          providerId: "injected-evm",
        });
      }
    } catch {
      // ignore
    }
  }
  const sol = getSolanaProvider();
  if (sol?.publicKey) {
    try {
      const address = sol.publicKey.toBase58();
      if (chainFamilyForAddress(address)) {
        setConnectedExternal({
          address,
          chainFamily: "solana",
          label: sol.isPhantom ? "Phantom" : "Solana wallet",
          providerId: "phantom-solana",
        });
      }
    } catch {
      // ignore
    }
  }
}
