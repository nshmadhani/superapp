import { describe, expect, it, vi, afterEach } from "vitest";
import { parseJsonFromE2bText } from "./e2b";
import { researchQueries } from "./runners/general";

describe("parseJsonFromE2bText", () => {
  it("parses stdout-style JSON", () => {
    const raw =
      '{"kind": "general", "summary": "hello", "bullets": ["a"], "citations": []}\n';
    const out = parseJsonFromE2bText<{ kind: string; summary: string }>(raw);
    expect(out.kind).toBe("general");
    expect(out.summary).toBe("hello");
  });

  it("rejects empty text", () => {
    expect(() => parseJsonFromE2bText("")).toThrow("e2b_json_parse_failed");
  });
});

describe("researchQueries", () => {
  it("extracts numbered topics from a research goal", () => {
    const goal = `Research report:
1. **Lighter (LTH)** project roadmap
2. HYPE DAO governance proposals
3. HyperEVM ecosystem direction
`;
    const qs = researchQueries(goal);
    expect(qs.length).toBeGreaterThanOrEqual(2);
    expect(qs.some((q) => /Lighter/i.test(q))).toBe(true);
  });
});

describe("runInE2b stdout merge", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("uses stdout when execution.text is empty", async () => {
    vi.stubEnv("E2B_API_KEY", "test-key");
    vi.doMock("@e2b/code-interpreter", () => ({
      Sandbox: {
        create: async () => ({
          sandboxId: "sbx",
          runCode: async () => ({
            text: "",
            error: null,
            logs: {
              stdout: [
                '{"kind":"general","summary":"from-stdout","bullets":[],"citations":[]}\n',
              ],
              stderr: [],
            },
          }),
          kill: async () => undefined,
        }),
      },
    }));
    const { runInE2b, parseJsonFromE2bText: parse } = await import("./e2b");
    const exec = await runInE2b("print(1)");
    expect(exec.text).toContain("from-stdout");
    expect(parse<{ summary: string }>(exec.text).summary).toBe("from-stdout");
  });
});
