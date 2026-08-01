import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchVenuePositions } from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchVenuePositions", () => {
  it("maps HL + Polymarket snapshots into VenuePositions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("hyperliquid")) {
          const body = JSON.parse(String(init?.body ?? "{}")) as {
            type?: string;
          };
          expect(body.type).toBe("clearinghouseState");
          return {
            ok: true,
            json: async () => ({
              marginSummary: { accountValue: "1000" },
              withdrawable: "800",
              assetPositions: [
                {
                  type: "oneWay",
                  position: {
                    coin: "ETH",
                    szi: "1",
                    entryPx: "2000",
                    positionValue: "2100",
                    unrealizedPnl: "100",
                    leverage: { value: 5 },
                  },
                },
              ],
            }),
          };
        }
        if (url.includes("/positions")) {
          return {
            ok: true,
            json: async () => [
              {
                title: "Will X happen?",
                outcome: "Yes",
                size: 10,
                currentValue: 6,
                cashPnl: 1,
                curPrice: 0.6,
                icon: "https://example.com/i.png",
              },
            ],
          };
        }
        if (url.includes("/value")) {
          return { ok: true, json: async () => [{ value: 6 }] };
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const out = await fetchVenuePositions([
      {
        address: "0x1111111111111111111111111111111111111111",
        walletId: "w1",
        chainFamily: "evm",
      },
    ]);

    expect(out.valueUsd).toBe(1006);
    expect(out.venues.find((v) => v.id === "hyperliquid")?.status).toBe(
      "ready",
    );
    expect(out.venues.find((v) => v.id === "polymarket")?.status).toBe(
      "ready",
    );
    expect(out.positions.some((p) => p.venue === "hyperliquid")).toBe(true);
    expect(out.positions.some((p) => p.venue === "polymarket")).toBe(true);
  });
});
