import { encodeFunctionData, erc20Abi, parseAbi } from "viem";
import { resolveMorphoVault, type MorphoVault } from "./vaults";

const erc4626Abi = parseAbi([
  "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
]);

export type MorphoLendRequest = {
  chainId: number;
  fromAddress: `0x${string}`;
  amount: string;
  vaultAddress?: string;
  receiver?: `0x${string}`;
};

export type MorphoLendQuote = {
  adapterId: "morpho";
  protocol: "morpho";
  vault: MorphoVault;
  amount: string;
  /** ERC-20 approve vault as spender */
  approveTx: {
    to: `0x${string}`;
    data: `0x${string}`;
    value: "0";
    chainId: number;
  };
  /** ERC-4626 deposit into MetaMorpho vault */
  depositTx: {
    to: `0x${string}`;
    data: `0x${string}`;
    value: "0";
    chainId: number;
  };
  displayRoute: string;
};

export async function quoteMorphoLend(
  req: MorphoLendRequest,
): Promise<MorphoLendQuote> {
  if (!req.amount || req.amount === "0") {
    throw new Error("morpho_amount_required");
  }
  const vault = await resolveMorphoVault({
    chainId: req.chainId,
    vaultAddress: req.vaultAddress,
  });
  const receiver = req.receiver ?? req.fromAddress;
  const assets = BigInt(req.amount);

  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [vault.address, assets],
  });
  const depositData = encodeFunctionData({
    abi: erc4626Abi,
    functionName: "deposit",
    args: [assets, receiver],
  });

  const apyPct = (vault.apy * 100).toFixed(2);
  return {
    adapterId: "morpho",
    protocol: "morpho",
    vault,
    amount: req.amount,
    approveTx: {
      to: vault.assetAddress,
      data: approveData,
      value: "0",
      chainId: req.chainId,
    },
    depositTx: {
      to: vault.address,
      data: depositData,
      value: "0",
      chainId: req.chainId,
    },
    displayRoute: `Lend ${vault.assetSymbol} → Morpho ${vault.name} (~${apyPct}% APY)`,
  };
}
