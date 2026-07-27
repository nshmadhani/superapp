/** Max Zerion HTTP starts per second (plan limit is 3; stay well under). */
export const ZERION_MAX_PER_SEC = 1;
const MIN_INTERVAL_MS = Math.ceil(1000 / ZERION_MAX_PER_SEC);

let chain: Promise<unknown> = Promise.resolve();
let lastStartedAt = 0;

/**
 * Serialize Zerion upstream calls and space starts ≥1s apart (≤1/sec).
 * Failures do not stall the queue.
 */
export function scheduleZerionCall<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, lastStartedAt + MIN_INTERVAL_MS - now);
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    lastStartedAt = Date.now();
    return fn();
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Test helper — resets spacing clock (does not clear portfolio cache). */
export function resetZerionRateLimitForTests() {
  chain = Promise.resolve();
  lastStartedAt = 0;
}
