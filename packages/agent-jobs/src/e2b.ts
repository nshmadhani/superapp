export type E2bExecResult = {
  text: string;
  sandboxId: string;
  logs: { stdout: string[]; stderr: string[] };
};

export function e2bConfigured(): boolean {
  return Boolean(process.env.E2B_API_KEY?.trim());
}

/**
 * Run Python in an E2B Code Interpreter sandbox.
 * Throws if E2B_API_KEY is missing or the sandbox fails.
 */
export async function runInE2b(code: string): Promise<E2bExecResult> {
  if (!e2bConfigured()) {
    throw new Error("E2B_API_KEY missing");
  }
  const { Sandbox } = await import("@e2b/code-interpreter");
  const sandbox = await Sandbox.create();
  try {
    const execution = await sandbox.runCode(code);
    const errText = (execution.error?.value ?? execution.error?.name ?? "").toString();
    if (execution.error) {
      throw new Error(`e2b_exec_error: ${errText || "unknown"}`);
    }
    return {
      text: execution.text ?? "",
      sandboxId: sandbox.sandboxId,
      logs: {
        stdout: execution.logs?.stdout ?? [],
        stderr: execution.logs?.stderr ?? [],
      },
    };
  } finally {
    await sandbox.kill().catch(() => undefined);
  }
}

/** Parse the last JSON object printed by sandbox code. */
export function parseJsonFromE2bText<T>(text: string): T {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.lastIndexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as T;
    }
    throw new Error("e2b_json_parse_failed");
  }
}
