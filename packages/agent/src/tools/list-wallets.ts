import { tool } from "ai";
import { z } from "zod";
import { store } from "../store";
import type { AgentContext } from "./index";

export function listWalletsTool(ctx: AgentContext) {
  return tool({
    description:
      "List wallets linked to the current user (embedded Turnkey or connected external). Each wallet has id, label (display name), address, and chainFamily (evm|solana).",
    inputSchema: z.object({}),
    execute: async () => {
      return { wallets: await store.listWallets(ctx.userId) };
    },
  });
}
