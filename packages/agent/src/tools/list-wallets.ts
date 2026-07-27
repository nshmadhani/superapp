import { tool } from "ai";
import { z } from "zod";
import { store } from "../store";
import { isAddressSignable, toSignableSet } from "../signable";
import type { AgentContext } from "./index";

export function listWalletsTool(ctx: AgentContext) {
  return tool({
    description:
      "List wallets linked to the current user. Each row includes signable=true|false from the LIVE Turnkey browser session (embedded + currently connected extensions). For any plan that must be signed (create_plan / create_action_plan source wallet), ONLY use wallets with signable=true. Balances may still show on non-signable wallets (e.g. Phantom disconnected) — mention funds if useful, but do not pick them as the signing source until the user reconnects.",
    inputSchema: z.object({}),
    execute: async () => {
      const wallets = await store.listWallets(ctx.userId);
      const signable = toSignableSet(ctx.signableAddresses);
      const enriched = wallets.map((w) => {
        const canSign = isAddressSignable(signable, w.address);
        return {
          ...w,
          signable: canSign === null ? undefined : canSign,
        };
      });
      const signableCount = enriched.filter((w) => w.signable === true).length;
      return {
        wallets: enriched,
        note:
          signable == null
            ? "Live session addresses not provided — treat all as possibly outdated for signing."
            : `${signableCount} of ${enriched.length} wallets are signable in the current Turnkey session. Prefer signable=true for create_plan / create_action_plan.`,
      };
    },
  });
}
