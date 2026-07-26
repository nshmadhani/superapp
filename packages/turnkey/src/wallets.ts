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

/**
 * Creates an Ethereum wallet in the Turnkey organization.
 * Prefer {@link createCipherWallet} for EVM + Solana.
 */
export async function createEvmWallet(
  label = "Cipher wallet",
): Promise<CreatedEvmWallet> {
  const created = await createCipherWallet(label);
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
 * Creates one Turnkey wallet with EVM + Solana accounts.
 * Never returns private key material — only wallet id + addresses.
 */
export async function createCipherWallet(
  label = "Cipher wallet",
): Promise<CreatedCipherWallet> {
  const turnkey = createTurnkeyClient();
  const api = turnkey.apiClient();

  const created = await api.createWallet({
    walletName: `${label} ${Date.now()}`,
    accounts: [
      {
        curve: "CURVE_SECP256K1",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/44'/60'/0'/0/0",
        addressFormat: "ADDRESS_FORMAT_ETHEREUM",
      },
      {
        curve: "CURVE_ED25519",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/44'/501'/0'/0'",
        addressFormat: "ADDRESS_FORMAT_SOLANA",
      },
    ],
  });

  const turnkeyWalletId = created.walletId;
  const addresses = created.addresses ?? [];
  if (!turnkeyWalletId || addresses.length === 0) {
    throw new Error("Turnkey createWallet did not return wallet id/address");
  }

  const accounts = addresses.map((address) => ({
    address,
    chainFamily: (address.startsWith("0x") ? "evm" : "solana") as
      | "evm"
      | "solana",
  }));

  return { turnkeyWalletId, accounts };
}
