import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@cipher/agent",
    "@cipher/agent-jobs",
    "@cipher/core",
    "@cipher/db",
    "@cipher/zerion",
    "@cipher/search",
    "@cipher/defillama",
    "@cipher/adapters",
    "@cipher/turnkey",
    "@cipher/rpc",
  ],
  serverExternalPackages: ["@turnkey/sdk-server", "@e2b/code-interpreter", "viem"],
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "16-bit-labs",
  project: process.env.SENTRY_PROJECT ?? "ervo",

  authToken: process.env.SENTRY_AUTH_TOKEN,

  widenClientFileUpload: true,

  // Proxy Sentry requests through the app to reduce ad-blocker drops
  tunnelRoute: "/monitoring",

  silent: !process.env.CI,
});
