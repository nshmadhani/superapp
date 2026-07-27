"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base, mainnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { useState, type ReactNode } from "react";
import {
  TurnkeyProvider,
  type TurnkeyProviderConfig,
} from "@turnkey/react-wallet-kit";
import { AuthSync } from "./auth-sync";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "";
const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3001";
const hasWalletConnect = walletConnectProjectId.length > 0;

// Wagmi is only used for light chain helpers — do NOT add wagmi's walletConnect
// connector. It pulls older @walletconnect/* and breaks Turnkey WC with:
// "this.client.core.relayer.publishCustom is not a function"
const wagmiConfig = createConfig({
  chains: [base, mainnet],
  connectors: [injected()],
  transports: {
    [base.id]: http(),
    [mainnet.id]: http(),
  },
  ssr: true,
});

const turnkeyConfig: TurnkeyProviderConfig = {
  organizationId: process.env.NEXT_PUBLIC_TURNKEY_ORGANIZATION_ID!,
  authProxyConfigId: process.env.NEXT_PUBLIC_TURNKEY_AUTH_PROXY_CONFIG_ID!,
  autoRefreshManagedState: true,
  ui: {
    darkMode: true,
  },
  // One modal: browser extensions (native) + WalletConnect QR
  walletConfig: {
    features: {
      auth: false,
      connecting: true,
    },
    chains: {
      ethereum: {
        native: true,
        ...(hasWalletConnect
          ? {
              walletConnectNamespaces: [
                "eip155:1",
                "eip155:8453", // Base
              ],
            }
          : {}),
      },
      solana: {
        native: true,
        ...(hasWalletConnect
          ? {
              walletConnectNamespaces: [
                "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
              ],
            }
          : {}),
      },
    },
    ...(hasWalletConnect
      ? {
          walletConnect: {
            projectId: walletConnectProjectId,
            appMetadata: {
              name: "Ervo",
              description: "AI crypto co-pilot",
              url: appUrl,
              icons: [`${appUrl}/icon.png`],
            },
          },
        }
      : {}),
  },
};

function logTurnkeyError(error: unknown) {
  const err = error as {
    message?: string;
    cause?: unknown;
    code?: string | number;
  };
  // WC init failures are non-fatal — Turnkey falls back to extension wallets
  if (
    err?.code === "WALLET_CONNECT_INITIALIZATION_ERROR" ||
    /WalletConnect initialization failed/i.test(String(err?.message ?? ""))
  ) {
    console.warn(
      "WalletConnect unavailable (extensions still work):",
      err.message,
      err.cause,
    );
    return;
  }
  console.error("Turnkey error:", err?.message ?? error);
  if (err?.cause) console.error("Turnkey error cause:", err.cause);
  if (err?.code != null) console.error("Turnkey error code:", err.code);
  // Surface nested Turnkey request ids from 5xx responses for support.
  const causeMsg =
    err?.cause instanceof Error
      ? err.cause.message
      : typeof err?.cause === "string"
        ? err.cause
        : err?.cause &&
            typeof err.cause === "object" &&
            "message" in err.cause
          ? String((err.cause as { message?: unknown }).message)
          : undefined;
  if (causeMsg && /\([0-9a-f-]{36}\)/i.test(causeMsg)) {
    console.error("Turnkey request id:", causeMsg.match(/\(([0-9a-f-]{36})\)/i)?.[1]);
  }
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <TurnkeyProvider
      config={turnkeyConfig}
      callbacks={{
        onError: logTurnkeyError,
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <AuthSync />
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </TurnkeyProvider>
  );
}
