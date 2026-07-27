import { createTurnkeyClient } from "./client";

export type CreatedEvmWallet = {
  turnkeyWalletId: string;
  address: `0x${string}`;
};

export type CreatedCipherWallet = {
  turnkeyWalletId: string;
  accounts: Array<{
    address: string;
    chainFamily: "evm" | "solana";
  }>;
};

export type CreateCipherWalletOpts = {
  /** User sub-org when creating agent wallets the user can sign with. */
  organizationId?: string;
  /** When true, only create an EVM account (default for agent wallets). */
  evmOnly?: boolean;
};

/**
 * Creates an Ethereum wallet in the Turnkey organization.
 * Prefer {@link createCipherWallet} for EVM + Solana.
 */
export async function createEvmWallet(
  label = "Cipher wallet",
  opts?: CreateCipherWalletOpts,
): Promise<CreatedEvmWallet> {
  const created = await createCipherWallet(label, {
    ...opts,
    evmOnly: true,
  });
  const evm = created.accounts.find((a) => a.chainFamily === "evm");
  if (!evm) {
    throw new Error("Turnkey createWallet did not return an EVM address");
  }
  return {
    turnkeyWalletId: created.turnkeyWalletId,
    address: evm.address as `0x${string}`,
  };
}

/**
 * Creates one Turnkey wallet with EVM (+ optional Solana) accounts.
 * Never returns private key material — only wallet id + addresses.
 */
export async function createCipherWallet(
  label = "Cipher wallet",
  opts?: CreateCipherWalletOpts,
): Promise<CreatedCipherWallet> {
  const turnkey = createTurnkeyClient();
  const api = turnkey.apiClient();

  const accounts = [
    {
      curve: "CURVE_SECP256K1" as const,
      pathFormat: "PATH_FORMAT_BIP32" as const,
      path: "m/44'/60'/0'/0/0",
      addressFormat: "ADDRESS_FORMAT_ETHEREUM" as const,
    },
    ...(opts?.evmOnly
      ? []
      : [
          {
            curve: "CURVE_ED25519" as const,
            pathFormat: "PATH_FORMAT_BIP32" as const,
            path: "m/44'/501'/0'/0'",
            addressFormat: "ADDRESS_FORMAT_SOLANA" as const,
          },
        ]),
  ];

  const created = await api.createWallet({
    ...(opts?.organizationId
      ? { organizationId: opts.organizationId }
      : {}),
    walletName: `${label} ${Date.now()}`,
    accounts,
  });

  const turnkeyWalletId = created.walletId;
  const addresses = created.addresses ?? [];
  if (!turnkeyWalletId || addresses.length === 0) {
    throw new Error("Turnkey createWallet did not return wallet id/address");
  }

  const mapped = addresses.map((address) => ({
    address,
    chainFamily: (address.startsWith("0x") ? "evm" : "solana") as
      | "evm"
      | "solana",
  }));

  return { turnkeyWalletId, accounts: mapped };
}
