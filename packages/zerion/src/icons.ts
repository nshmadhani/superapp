/** Zerion chain ids → Trust Wallet assets blockchain folder names. */
const TW_CHAIN: Record<string, string> = {
  ethereum: "ethereum",
  base: "base",
  arbitrum: "arbitrum",
  optimism: "optimism",
  polygon: "polygon",
  bsc: "smartchain",
  binance: "smartchain",
  avalanche: "avalanchec",
  avax: "avalanchec",
  solana: "solana",
  blast: "blast",
  zora: "zora",
  linea: "linea",
  scroll: "scroll",
  gnosis: "xdai",
  xdai: "xdai",
  mantle: "mantle",
  celo: "celo",
  fantom: "fantom",
  zkSync: "zksync",
  zksync: "zksync",
  mode: "mode",
};

const TW_ASSET_BASE =
  "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains";

const LLAMA_PROTOCOL =
  "https://icons.llamao.fi/icons/protocols";

/**
 * Major DeFi / venue protocols → DeFiLlama icon slug.
 * Keys are lowercase; resolveProtocolIcon normalizes Zerion names.
 */
const PROTOCOL_SLUGS: Record<string, string> = {
  morpho: "morpho",
  aave: "aave",
  "aave v2": "aave-v2",
  "aave v3": "aave-v3",
  aavev2: "aave-v2",
  aavev3: "aave-v3",
  uniswap: "uniswap",
  "uniswap v2": "uniswap-v2",
  "uniswap v3": "uniswap-v3",
  "uniswap v4": "uniswap-v4",
  compound: "compound",
  "compound v2": "compound",
  "compound v3": "compound-v3",
  lido: "lido",
  curve: "curve-dex",
  "curve finance": "curve-dex",
  pendle: "pendle",
  spark: "spark",
  fluid: "fluid",
  yearn: "yearn-finance",
  "yearn finance": "yearn-finance",
  maker: "makerdao",
  makerdao: "makerdao",
  sky: "sky",
  balancer: "balancer",
  convex: "convex-finance",
  "convex finance": "convex-finance",
  ethena: "ethena",
  eigenlayer: "eigenlayer",
  "rocket pool": "rocket-pool",
  rocketpool: "rocket-pool",
  frax: "frax",
  fraxlend: "fraxlend",
  gmx: "gmx",
  hyperliquid: "hyperliquid",
  polymarket: "polymarket",
  jupiter: "jupiter",
  marinade: "marinade-finance",
  raydium: "raydium",
  orca: "orca",
  drift: "drift",
  kamino: "kamino",
  mango: "mango-markets",
  "mango markets": "mango-markets",
  sushi: "sushiswap",
  sushiswap: "sushiswap",
  cowswap: "cowswap",
  "cow swap": "cowswap",
  across: "across",
  stargate: "stargate",
  hop: "hop-protocol",
  "hop protocol": "hop-protocol",
  etherfi: "ether.fi",
  "ether.fi": "ether.fi",
  renzo: "renzo",
  kelp: "kelpdao",
  kelpdao: "kelpdao",
  swell: "swell",
  pancakswap: "pancakeswap",
  pancakeswap: "pancakeswap",
  venus: "venus",
  beefy: "beefy",
  radiants: "radiant",
  radiant: "radiant",
  silo: "silo-finance",
  "silo finance": "silo-finance",
  maple: "maple",
  goldfinch: "goldfinch",
  ambient: "ambient",
  aerodrome: "aerodrome",
  velodrome: "velodrome",
  moonwell: "moonwell",
  seamless: "seamless",
  extrafi: "extra-finance",
  "extra finance": "extra-finance",
  gauntlet: "morpho", // Zerion sometimes labels vault brand; Morpho is parent
};

// Numeric-leading keys can't be bare identifiers in object literals.
PROTOCOL_SLUGS["1inch"] = "1inch-network";

function llamaProtocolIcon(slug: string): string {
  return `${LLAMA_PROTOCOL}/${slug}?w=48&h=48`;
}

/**
 * Chain / network logo (Trust Wallet blockchain info logo).
 */
export function resolveChainIcon(chainId: string | null | undefined): string | null {
  if (!chainId) return null;
  const key = chainId.toLowerCase().trim();
  // HyperEVM isn't in TW assets — use Hyperliquid branding as a stand-in.
  if (key === "hyperevm" || key === "hyperliquid") {
    return llamaProtocolIcon("hyperliquid");
  }
  const tw = TW_CHAIN[key];
  if (!tw) return null;
  return `${TW_ASSET_BASE}/${tw}/info/logo.png`;
}

/**
 * Protocol / venue logo for major DeFi apps (DeFiLlama icons).
 */
export function resolveProtocolIcon(
  protocol: string | null | undefined,
): string | null {
  if (!protocol) return null;
  const raw = protocol.trim().toLowerCase();
  if (!raw) return null;

  const direct = PROTOCOL_SLUGS[raw];
  if (direct) return llamaProtocolIcon(direct);

  // Strip version suffixes / punctuation: "Aave V3" → try "aave v3", "aave"
  const spaced = raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (PROTOCOL_SLUGS[spaced]) return llamaProtocolIcon(PROTOCOL_SLUGS[spaced]!);

  const noVersion = spaced.replace(/\s*v\d+(\.\d+)?$/i, "").trim();
  if (noVersion && PROTOCOL_SLUGS[noVersion]) {
    return llamaProtocolIcon(PROTOCOL_SLUGS[noVersion]!);
  }

  // First token match: "Morpho Blue" → morpho
  const first = spaced.split(" ")[0];
  if (first && PROTOCOL_SLUGS[first]) {
    return llamaProtocolIcon(PROTOCOL_SLUGS[first]!);
  }

  return null;
}

/**
 * Hybrid logo resolution: Zerion icon → Trust Wallet CDN → null (UI letter).
 */
export function resolveTokenIcon(opts: {
  iconUrl?: string | null;
  chainId?: string | null;
  address?: string | null;
}): string | null {
  if (opts.iconUrl && /^https?:\/\//i.test(opts.iconUrl)) {
    return opts.iconUrl;
  }
  const chain = opts.chainId ? TW_CHAIN[opts.chainId.toLowerCase()] : undefined;
  if (!chain) {
    if (
      opts.chainId &&
      ["hyperevm", "hyperliquid"].includes(opts.chainId.toLowerCase())
    ) {
      return resolveChainIcon(opts.chainId);
    }
    return null;
  }
  const addr = opts.address?.trim();
  if (!addr) {
    return `${TW_ASSET_BASE}/${chain}/info/logo.png`;
  }
  // EVM addresses in TW assets are checksummed; lowercasing still works for GH paths on most chains.
  const pathAddr = addr.startsWith("0x") ? addr : addr;
  return `${TW_ASSET_BASE}/${chain}/assets/${pathAddr}/logo.png`;
}
