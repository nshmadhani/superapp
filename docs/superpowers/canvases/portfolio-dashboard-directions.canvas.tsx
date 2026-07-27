import type { ReactNode } from "react";
import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  UsageBar,
  useCanvasState,
  useHostTheme,
} from "cursor/canvas";

type Direction = "A" | "B" | "C";

const TOTAL = 53483.45;

const WALLETS = [
  { id: "vault", label: "Vault", kind: "External", usd: 25100, share: 47 },
  { id: "trading", label: "Trading", kind: "App", usd: 18420.55, share: 34 },
  { id: "sol", label: "Solana", kind: "App", usd: 9120.4, share: 17 },
  { id: "dca", label: "DCA agent", kind: "Agent", usd: 842.5, share: 2 },
];

const CHAINS = [
  { id: "eth", label: "Ethereum", usd: 25100 },
  { id: "base", label: "Base", usd: 19263.05 },
  { id: "sol", label: "Solana", usd: 9120.4 },
];

const ASSETS = [
  { symbol: "ETH", usd: 24402.6, wallets: "Vault · Trading · DCA", chains: "ethereum · base" },
  { symbol: "USDC", usd: 8640.4, wallets: "Trading · Solana · DCA", chains: "base · solana" },
  { symbol: "aUSDC", usd: 9340, wallets: "Vault", chains: "ethereum" },
  { symbol: "SOL", usd: 5200, wallets: "Solana", chains: "solana" },
  { symbol: "cbBTC", usd: 3800.45, wallets: "Trading", chains: "base" },
  { symbol: "JUP", usd: 1500, wallets: "Solana", chains: "solana" },
];

function usd(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function MockChrome({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const theme = useHostTheme();
  return (
    <div
      style={{
        border: `1px solid ${theme.stroke.secondary}`,
        borderRadius: 8,
        background: theme.bg.elevated,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid ${theme.stroke.tertiary}`,
          background: theme.fill.tertiary,
        }}
      >
        <Text weight="semibold" size="small">
          {title}
        </Text>
        <Text size="small" tone="secondary">
          {subtitle}
        </Text>
      </div>
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  );
}

function MockA() {
  const theme = useHostTheme();
  const [focus, setFocus] = useCanvasState<string>("mock-a-focus", "overview");
  const active = WALLETS.find((w) => w.id === focus);

  return (
    <MockChrome
      title="A · Wallet Worlds"
      subtitle="Rainbow-style: wallets as primary places, then drill in"
    >
      <Stack gap={12}>
        <Row align="end" justify="space-between">
          <Stack gap={2}>
            <Text size="small" tone="tertiary">
              {focus === "overview" ? "All wallets" : active?.label}
            </Text>
            <Text weight="semibold" style={{ fontSize: 22 }}>
              {focus === "overview" ? usd(TOTAL) : usd(active?.usd ?? 0)}
            </Text>
          </Stack>
          {focus !== "overview" && (
            <Button variant="ghost" onClick={() => setFocus("overview")}>
              Back to overview
            </Button>
          )}
        </Row>

        {focus === "overview" ? (
          <>
            <Grid columns={2} gap={8}>
              {WALLETS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setFocus(w.id)}
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    border: `1px solid ${theme.stroke.secondary}`,
                    borderRadius: 6,
                    padding: "10px 12px",
                    background: theme.bg.editor,
                    color: "inherit",
                  }}
                >
                  <Row align="center" gap={6}>
                    <Text weight="semibold" size="small">
                      {w.label}
                    </Text>
                    <Pill size="sm">{w.kind}</Pill>
                  </Row>
                  <Text weight="semibold">{usd(w.usd)}</Text>
                </button>
              ))}
            </Grid>
            <UsageBar
              total={TOTAL}
              topLeftLabel="Allocation by wallet"
              topRightLabel={usd(TOTAL)}
              segments={WALLETS.map((w) => ({
                id: w.id,
                value: w.usd,
              }))}
            />
            <Text size="small" tone="secondary">
              Click a wallet card to enter its world (balances, chains, activity).
            </Text>
          </>
        ) : (
          <Stack gap={8}>
            <Row gap={6} wrap>
              <Pill tone="info" size="sm" active>
                Balances
              </Pill>
              <Pill size="sm">Chains</Pill>
              <Pill size="sm">Activity</Pill>
            </Row>
            <Table
              headers={["Asset", "Chain", "USD"]}
              columnAlign={["left", "left", "right"]}
              rows={
                focus === "vault"
                  ? [
                      ["ETH", "ethereum", "$15,760"],
                      ["aUSDC", "ethereum", "$9,340"],
                    ]
                  : focus === "trading"
                    ? [
                        ["ETH", "base", "$8,420"],
                        ["USDC", "base", "$6,200"],
                        ["cbBTC", "base", "$3,800"],
                      ]
                    : focus === "sol"
                      ? [
                          ["SOL", "solana", "$5,200"],
                          ["USDC", "solana", "$2,420"],
                          ["JUP", "solana", "$1,500"],
                        ]
                      : [
                          ["USDC", "base", "$620"],
                          ["ETH", "base", "$223"],
                        ]
              }
              striped
            />
          </Stack>
        )}
      </Stack>
    </MockChrome>
  );
}

function MockB() {
  const theme = useHostTheme();
  const [groupBy, setGroupBy] = useCanvasState<"asset" | "wallet" | "chain" | "protocol">(
    "mock-b-groupby",
    "asset",
  );
  const [expanded, setExpanded] = useCanvasState<string | null>("mock-b-expanded", "ETH");

  const groups =
    groupBy === "asset"
      ? ASSETS.map((a) => ({
          key: a.symbol,
          title: a.symbol,
          meta: a.wallets,
          usd: a.usd,
          detail:
            a.symbol === "ETH"
              ? [
                  ["Vault", "ethereum", "4.00", "$15,760"],
                  ["Trading", "base", "2.14", "$8,420"],
                  ["DCA agent", "base", "0.056", "$223"],
                ]
              : a.symbol === "USDC"
                ? [
                    ["Trading", "base", "6,200", "$6,200"],
                    ["Solana", "solana", "2,420", "$2,420"],
                    ["DCA agent", "base", "620", "$620"],
                  ]
                : [[a.wallets.split(" · ")[0], a.chains.split(" · ")[0], "—", usd(a.usd)]],
        }))
      : groupBy === "wallet"
        ? WALLETS.map((w) => ({
            key: w.id,
            title: w.label,
            meta: w.kind,
            usd: w.usd,
            detail: [["See positions", "—", "—", usd(w.usd)]],
          }))
        : groupBy === "chain"
          ? CHAINS.map((c) => ({
              key: c.id,
              title: c.label,
              meta: "multi-wallet",
              usd: c.usd,
              detail: [["See positions", c.label.toLowerCase(), "—", usd(c.usd)]],
            }))
          : [
              {
                key: "aave",
                title: "Aave",
                meta: "Vault · ethereum",
                usd: 9340,
                detail: [["aUSDC", "ethereum", "9,340", "$9,340"]],
              },
              {
                key: "spot",
                title: "Spot / wallet",
                meta: "all wallets",
                usd: 44143.45,
                detail: [["ETH, USDC, SOL…", "mixed", "—", "$44,143"]],
              },
            ];

  return (
    <MockChrome
      title="B · Smart Group-by"
      subtitle="DeBank/Zerion hybrid: pivot axis, expand to see where money lives"
    >
      <Stack gap={12}>
        <Row align="end" justify="space-between">
          <Stack gap={2}>
            <Text size="small" tone="tertiary">
              Net worth
            </Text>
            <Text weight="semibold" style={{ fontSize: 22 }}>
              {usd(TOTAL)}
            </Text>
          </Stack>
          <Text size="small" tone="secondary">
            Same data as chat portfolio tool
          </Text>
        </Row>

        <Row gap={6} wrap>
          {(
            [
              ["asset", "Asset"],
              ["wallet", "Wallet"],
              ["chain", "Chain"],
              ["protocol", "Protocol"],
            ] as const
          ).map(([id, label]) => (
            <span key={id}>
              <Button
                variant={groupBy === id ? "primary" : "secondary"}
                onClick={() => {
                  setGroupBy(id);
                  setExpanded(null);
                }}
              >
                {label}
              </Button>
            </span>
          ))}
        </Row>

        <Stack gap={6}>
          {groups.slice(0, 5).map((g) => {
            const open = expanded === g.key;
            return (
              <div
                key={g.key}
                style={{
                  border: `1px solid ${theme.stroke.secondary}`,
                  borderRadius: 6,
                  background: theme.bg.editor,
                }}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : g.key)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                    border: "none",
                    background: "transparent",
                    color: "inherit",
                    padding: "10px 12px",
                  }}
                >
                  <Row align="center" justify="space-between">
                    <Stack gap={2}>
                      <Text weight="semibold" size="small">
                        {open ? "▾ " : "▸ "}
                        {g.title}
                      </Text>
                      <Text size="small" tone="tertiary">
                        {g.meta}
                      </Text>
                    </Stack>
                    <Text weight="semibold" size="small">
                      {usd(g.usd)}
                    </Text>
                  </Row>
                </button>
                {open && (
                  <div
                    style={{
                      borderTop: `1px solid ${theme.stroke.tertiary}`,
                      padding: "8px 12px 10px",
                    }}
                  >
                    <Table
                      headers={["Wallet", "Chain", "Qty", "USD"]}
                      columnAlign={["left", "left", "right", "right"]}
                      rows={g.detail}
                      framed={false}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </Stack>
      </Stack>
    </MockChrome>
  );
}

function MockC() {
  const theme = useHostTheme();
  const [layer, setLayer] = useCanvasState<"map" | "venues" | "drill">("mock-c-layer", "map");

  return (
    <MockChrome
      title="C · Money Map"
      subtitle="Avocado/Instadapp-style consolidation: pockets + venues as first-class"
    >
      <Stack gap={12}>
        <Row gap={6} wrap>
          <Button
            variant={layer === "map" ? "primary" : "secondary"}
            onClick={() => setLayer("map")}
          >
            Map
          </Button>
          <Button
            variant={layer === "venues" ? "primary" : "secondary"}
            onClick={() => setLayer("venues")}
          >
            Venues
          </Button>
          <Button
            variant={layer === "drill" ? "primary" : "secondary"}
            onClick={() => setLayer("drill")}
          >
            Drill · ETH
          </Button>
        </Row>

        {layer === "map" && (
          <Stack gap={10}>
            <Stat value={usd(TOTAL)} label="Consolidated net worth" />
            <UsageBar
              total={100}
              topLeftLabel="Wallets vs venues"
              topRightLabel="94% wallets · 6% venues (illustrative)"
              segments={[
                { id: "wallets", value: 94, color: "blue" },
                { id: "venues", value: 6, color: "purple" },
              ]}
            />
            <Grid columns={2} gap={8}>
              {[
                ["Funding wallets", usd(53483), "4 connected"],
                ["Venue pockets", "$3,200", "HL linked · Poly needs deposit"],
                ["Chains", "3", "ethereum · base · solana"],
                ["Protocols", "1 live", "Aave aUSDC on Vault"],
              ].map(([t, v, s]) => (
                <div
                  key={t}
                  style={{
                    border: `1px solid ${theme.stroke.secondary}`,
                    borderRadius: 6,
                    padding: "10px 12px",
                    background: theme.bg.editor,
                  }}
                >
                  <Text size="small" tone="tertiary">
                    {t}
                  </Text>
                  <Text weight="semibold">{v}</Text>
                  <Text size="small" tone="secondary">
                    {s}
                  </Text>
                </div>
              ))}
            </Grid>
          </Stack>
        )}

        {layer === "venues" && (
          <Table
            headers={["Pocket", "Backing wallet", "Status", "USD"]}
            columnAlign={["left", "left", "left", "right"]}
            rowTone={["success", "warning"]}
            rows={[
              ["Hyperliquid", "Trading", "Ready", "$3,200"],
              ["Polymarket", "Trading", "Needs deposit", "$0"],
            ]}
            striped
          />
        )}

        {layer === "drill" && (
          <Stack gap={8}>
            <Text weight="semibold">ETH · $24,403 across 3 wallets</Text>
            <UsageBar
              total={24403}
              topLeftLabel="Where ETH sits"
              topRightLabel="$24,403"
              segments={[
                { id: "vault", value: 15760, color: "blue" },
                { id: "trading", value: 8420, color: "green" },
                { id: "dca", value: 223, color: "orange" },
              ]}
            />
            <Table
              headers={["Location", "Role", "Chain", "USD"]}
              columnAlign={["left", "left", "left", "right"]}
              rows={[
                ["Vault", "Cold / savings", "ethereum", "$15,760"],
                ["Trading", "Hot", "base", "$8,420"],
                ["DCA agent", "Automation", "base", "$223"],
              ]}
              striped
            />
            <Text size="small" tone="secondary">
              Chat parity: “Where is my ETH?” opens this same drill view.
            </Text>
          </Stack>
        )}
      </Stack>
    </MockChrome>
  );
}

function OptionCard({
  id,
  title,
  inspired,
  bestFor,
  tradeoffs,
  selected,
  onSelect,
}: {
  id: Direction;
  title: string;
  inspired: string;
  bestFor: string;
  tradeoffs: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const theme = useHostTheme();
  return (
    <Card
      style={
        selected
          ? { outline: `2px solid ${theme.accent.primary}`, outlineOffset: 0 }
          : undefined
      }
    >
      <CardHeader
        trailing={
          selected ? (
            <Pill tone="success" active size="sm">
              Selected
            </Pill>
          ) : (
            <Pill size="sm">{id}</Pill>
          )
        }
      >
        {title}
      </CardHeader>
      <CardBody>
        <Stack gap={10}>
          <Text size="small" tone="secondary">
            Inspired by {inspired}
          </Text>
          <Stack gap={4}>
            <Text size="small" weight="semibold">
              Best for
            </Text>
            <Text size="small">{bestFor}</Text>
          </Stack>
          <Stack gap={4}>
            <Text size="small" weight="semibold">
              Tradeoff
            </Text>
            <Text size="small" tone="secondary">
              {tradeoffs}
            </Text>
          </Stack>
          <Button variant={selected ? "primary" : "secondary"} onClick={onSelect}>
            {selected ? `Using ${id}` : `Choose ${id}`}
          </Button>
        </Stack>
      </CardBody>
    </Card>
  );
}

export default function PortfolioDashboardDirections() {
  const theme = useHostTheme();
  const [choice, setChoice] = useCanvasState<Direction>("direction", "B");

  return (
    <Stack gap={28} style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <Stack gap={8}>
        <H1>Portfolio dashboard directions</H1>
        <Text tone="secondary">
          Cipher vision: one place to answer “where is my money?” across wallets, chains, and
          venues — with chat + dashboard parity. Below: research patterns, three selectable
          mockups (demo fixture numbers), and a recommendation. Pick A/B/C; we infuse later.
        </Text>
      </Stack>

      <Callout tone="info" title="Recommendation: B · Smart Group-by">
        Closest to the written vision (simple group-by + easy drill-down + multi-wallet). Use A’s
        wallet cards as the overview chrome, and C’s VenueAccounts strip when HL/Poly land in the
        demo. Default selection is B — change it below.
      </Callout>

      <Stack gap={10}>
        <H2>What strong products do</H2>
        <Grid columns={2} gap={12}>
          <Card>
            <CardHeader>Rainbow</CardHeader>
            <CardBody>
              <Text size="small">
                Beautiful single-wallet world: big balance, token list, chain context. Weak at
                multi-wallet consolidation — Cipher’s problem is the opposite (many wallets).
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>Zerion</CardHeader>
            <CardBody>
              <Text size="small">
                DeFi-aware positions + clean asset timeline. Strong “what I hold” list; group-by
                pivots are secondary to the feed.
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>DeBank</CardHeader>
            <CardBody>
              <Text size="small">
                Protocol/protocol-stack depth across chains for addresses. Power-user density;
                answers “where” well but can overwhelm retail.
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>Instadapp / Avocado</CardHeader>
            <CardBody>
              <Text size="small">
                Consolidation layer: one surface over many protocols / multi-chain abstraction.
                Closest spiritual cousin to Cipher’s “home for crypto” — UI often more map than
                spreadsheet.
              </Text>
            </CardBody>
          </Card>
        </Grid>
        <Text size="small" tone="tertiary">
          Source: product pattern recall vs Cipher VISION.md + §3.2 Dashboard (multi-wallet worlds,
          VenueAccounts, chat parity). Demo fixtures: Trading / Solana / Vault / DCA · ~$53.5k.
        </Text>
      </Stack>

      <Stack gap={10}>
        <H2>Choose a direction</H2>
        <Text size="small" tone="secondary">
          Selection persists in this canvas. Tell the agent “infuse direction X” when ready.
        </Text>
        <Grid columns={3} gap={12}>
          <OptionCard
            id="A"
            title="Wallet Worlds"
            inspired="Rainbow + current demo"
            bestFor="Users who think in named wallets (Hot / Vault / Agent)."
            tradeoffs="Cross-wallet questions (“all my ETH”) need a second hop."
            selected={choice === "A"}
            onSelect={() => setChoice("A")}
          />
          <OptionCard
            id="B"
            title="Smart Group-by"
            inspired="DeBank list + Zerion clarity"
            bestFor="“Where is my money?” with Asset / Wallet / Chain / Protocol pivots."
            tradeoffs="Slightly more UI chrome; must keep pivots to 3–4 max."
            selected={choice === "B"}
            onSelect={() => setChoice("B")}
          />
          <OptionCard
            id="C"
            title="Money Map"
            inspired="Avocado / Instadapp consolidation"
            bestFor="Storytelling the consolidation layer + VenueAccounts."
            tradeoffs="Harder to ship cleanly in a YC walkthrough; denser design."
            selected={choice === "C"}
            onSelect={() => setChoice("C")}
          />
        </Grid>
      </Stack>

      <Divider />

      <Stack gap={10}>
        <Row align="center" justify="space-between">
          <H2>Interactive mockups</H2>
          <Pill active>Selected · {choice}</Pill>
        </Row>
        <Text size="small" tone="secondary">
          Click through each mock. Your choice above outlines the matching mockup — all three stay
          visible for comparison.
        </Text>

        <div
          style={
            choice === "A"
              ? {
                  outline: `2px solid ${theme.accent.primary}`,
                  outlineOffset: 4,
                  borderRadius: 10,
                }
              : undefined
          }
        >
          <MockA />
        </div>
        <div
          style={
            choice === "B"
              ? {
                  outline: `2px solid ${theme.accent.primary}`,
                  outlineOffset: 4,
                  borderRadius: 10,
                }
              : undefined
          }
        >
          <MockB />
        </div>
        <div
          style={
            choice === "C"
              ? {
                  outline: `2px solid ${theme.accent.primary}`,
                  outlineOffset: 4,
                  borderRadius: 10,
                }
              : undefined
          }
        >
          <MockC />
        </div>
      </Stack>

      <Stack gap={10}>
        <H2>Fit to Cipher (scorecard)</H2>
        <Table
          headers={["Criterion", "A Worlds", "B Group-by", "C Map"]}
          columnAlign={["left", "center", "center", "center"]}
          rows={[
            ["Multi-wallet inventory (~20)", "Strong", "Strong", "Strong"],
            ["Simple group-by", "Weak", "Strong", "Medium"],
            ["Drill-down “where is X”", "Medium", "Strong", "Strong"],
            ["Chat ↔ dashboard parity", "Medium", "Strong", "Medium"],
            ["VenueAccounts (HL / Poly)", "Add-on", "Add-on row", "First-class"],
            ["YC demo polish speed", "Fastest", "Fast", "Slowest"],
            ["Matches VISION one-liner", "Partial", "Best", "Best story"],
          ]}
          striped
        />
      </Stack>

      <Stack gap={10}>
        <H2>Infuse later (when you pick)</H2>
        <Grid columns={3} gap={12}>
          <Card>
            <CardHeader>If A</CardHeader>
            <CardBody>
              <Text size="small">
                Keep wallet cards; drop flat overview table; add wallet detail tabs (Balances /
                Chains / Activity). Soften the select dropdown into the cards themselves.
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>If B</CardHeader>
            <CardBody>
              <Text size="small">
                Replace overview table with expandable groups + Asset/Wallet/Chain/Protocol
                toggle. Wire chat “where is my ETH” to open the same expanded asset row.
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>If C</CardHeader>
            <CardBody>
              <Text size="small">
                Add allocation map + VenueAccounts strip; keep a compact list under the map. Best
                after venue fixtures exist in the demo.
              </Text>
            </CardBody>
          </Card>
        </Grid>
      </Stack>

      <Callout tone="neutral" title="Current selection">
        Direction {choice}. Reply in chat with “go with {choice}” (or change the selection above)
        to infuse into `demo-dashboard.tsx`. Live demo was not overhauled — ideas only.
      </Callout>
    </Stack>
  );
}
