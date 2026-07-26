import { Turnkey } from "@turnkey/sdk-server";

export function createTurnkeyClient(env: NodeJS.ProcessEnv = process.env) {
  const apiPublicKey = env.TURNKEY_API_PUBLIC_KEY;
  const apiPrivateKey = env.TURNKEY_API_PRIVATE_KEY;
  const defaultOrganizationId = env.TURNKEY_ORGANIZATION_ID;
  if (!apiPublicKey || !apiPrivateKey || !defaultOrganizationId) {
    throw new Error("Missing Turnkey env (API keys or organization id)");
  }
  return new Turnkey({
    apiBaseUrl: "https://api.turnkey.com",
    apiPublicKey,
    apiPrivateKey,
    defaultOrganizationId,
  });
}
