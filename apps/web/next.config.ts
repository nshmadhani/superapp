import type { NextConfig } from "next";

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
  serverExternalPackages: ["@turnkey/sdk-server", "@e2b/code-interpreter"],
};

export default nextConfig;
