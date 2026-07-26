import { describe, it, expect, vi, afterEach } from "vitest";
import { webSearch } from "./tavily";

describe("webSearch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps tavily results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              title: "Aave",
              url: "https://example.com",
              content: "lending",
            },
          ],
        }),
      }),
    );
    const hits = await webSearch("aave", "key");
    expect(hits[0]?.title).toBe("Aave");
  });
});
