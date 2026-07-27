import { describe, expect, it } from "vitest";
import { runGeneralJob } from "./runners/general";
import { runDaoJob } from "./runners/dao";
import { runTaJob } from "./runners/ta";

const live = Boolean(process.env.E2B_API_KEY && process.env.TAVILY_API_KEY);

describe.runIf(live)("research live", () => {
  it("general produces citations", async () => {
    const g = await runGeneralJob(
      `Research Lighter (LTH) on HyperEVM:\n1. Lighter protocol product and tokenomics\n2. HYPE DAO governance direction`,
      {},
    );
    expect(g.source).toBe("live");
    expect(g.artifact.citations?.length ?? 0).toBeGreaterThan(0);
    expect(g.artifact.bullets.length).toBeGreaterThan(0);
  }, 120_000);

  it("dao produces citations", async () => {
    const d = await runDaoJob("Lighter LTH HyperEVM", {
      topic: "Lighter LTH HyperEVM HYPE DAO",
    });
    expect(d.source).toBe("live");
    expect(d.artifact.citations.length).toBeGreaterThan(0);
  }, 120_000);

  it("ta works on binance.us", async () => {
    const t = await runTaJob("TA on ETH daily", { symbol: "ETH", interval: "1d" });
    expect(t.artifact.kind).toBe("ta");
    expect(t.artifact.series.length).toBeGreaterThan(10);
  }, 120_000);
});
