import { createClient, type SDKClient } from "@lifi/sdk";

let cached: SDKClient | null = null;

export function createLifiClient(): SDKClient {
  if (cached) return cached;
  cached = createClient({
    integrator: process.env.LIFI_INTEGRATOR?.trim() || "ervo",
    apiKey: process.env.LIFI_API_KEY?.trim() || undefined,
  });
  return cached;
}

/** Test helper — reset singleton between tests */
export function resetLifiClientForTests() {
  cached = null;
}
