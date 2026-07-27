import { tool } from "ai";
import { z } from "zod";
import { fetchAggregatedPortfolio, fetchPortfolio } from "@cipher/zerion";
import { store } from "../store";
import type { AgentContext } from "./index";

function addressesMatch(a: string, b: string): boolean {
  if (a.startsWith("0x") || b.startsWith("0x")) {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}

export function getPortfolioTool(ctx: AgentContext) {
  return tool({
    description:
      "Fetch current token balances and USD values via Zerion for EVM or Solana wallets. Prefer walletId from list_wallets. Pass all=true to aggregate every linked wallet. Always inspect native gas (ETH/HYPE/SOL) on the relevant chain before proposing swaps, bridges, or lends — ~0 native means the wallet cannot sign ERC20 txs on that chain.",
    inputSchema: z.object({
      walletId: z
        .string()
        .optional()
        .describe("Cipher wallet id from list_wallets (preferred)"),
      address: z
        .string()
        .optional()
        .describe("EVM or Solana address owned by the user"),
      all: z
        .boolean()
        .optional()
        .describe("If true, aggregate portfolio across all linked wallets"),
    }),
    execute: async ({ walletId, address, all }) => {
      try {
        const wallets = await store.listWallets(ctx.userId);
        if (wallets.length === 0) {
          return {
            error: "no_wallets",
            message:
              "User has no wallets synced yet. Ask them to create or connect a wallet.",
          };
        }

        if (all) {
          const aggregated = await fetchAggregatedPortfolio(wallets);
          return {
            type: "portfolio_overview" as const,
            ...aggregated,
            wallets: aggregated.wallets.map((w) => ({
              ...w,
              label: w.label ?? w.source,
            })),
          };
        }

        let target = walletId
          ? wallets.find((w) => w.id === walletId)
          : undefined;

        if (!target && address) {
          target = wallets.find((w) => addressesMatch(w.address, address));
          if (!target) {
            return {
              error: "address_not_owned",
              message: "That address is not one of the user's linked wallets.",
            };
          }
        }

        if (!target) {
          if (wallets.length === 1) target = wallets[0];
          else {
            return {
              error: "wallet_ambiguous",
              message:
                "Call list_wallets and ask which wallet, or pass all=true for an overview.",
              wallets: wallets.map((w) => ({
                id: w.id,
                address: w.address,
                chainFamily: w.chainFamily,
                label: w.label,
              })),
            };
          }
        }

        const snapshot = await fetchPortfolio(target.address);
        return {
          type: "portfolio" as const,
          ...snapshot,
          walletId: target.id,
          label: target.label,
          source: target.source,
          chainFamily: target.chainFamily,
        };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "portfolio_failed",
        };
      }
    },
  });
}
