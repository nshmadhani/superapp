export type EvmSwapQuoteRequest = {
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  taker: string;
};

export type EvmSwapQuote = {
  adapterId: "evm-swap";
  to: string;
  data: string;
  value: string;
  minBuyAmount: string;
  displayRoute: string;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  chainId: number;
};

export async function quoteEvmSwap(
  req: EvmSwapQuoteRequest,
  apiKey = process.env.ZEROX_API_KEY,
): Promise<EvmSwapQuote> {
  if (!apiKey) throw new Error("Missing ZEROX_API_KEY");

  const url = new URL("https://api.0x.org/swap/allowance-holder/quote");
  url.searchParams.set("chainId", String(req.chainId));
  url.searchParams.set("sellToken", req.sellToken);
  url.searchParams.set("buyToken", req.buyToken);
  url.searchParams.set("sellAmount", req.sellAmount);
  url.searchParams.set("taker", req.taker);

  const res = await fetch(url, {
    headers: {
      "0x-api-key": apiKey,
      "0x-version": "v2",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`0x ${res.status}: ${text}`);
  }

  const q = (await res.json()) as {
    transaction: { to: string; data: string; value: string };
    minBuyAmount: string;
  };

  return {
    adapterId: "evm-swap",
    to: q.transaction.to,
    data: q.transaction.data,
    value: q.transaction.value ?? "0",
    minBuyAmount: q.minBuyAmount,
    displayRoute: `${req.sellToken} -> ${req.buyToken}`,
    sellToken: req.sellToken,
    buyToken: req.buyToken,
    sellAmount: req.sellAmount,
    chainId: req.chainId,
  };
}
