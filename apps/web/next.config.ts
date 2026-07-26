import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@cipher/agent",
    "@cipher/core",
    "@cipher/db",
    "@cipher/zerion",
    "@cipher/search",
    "@cipher/defillama",
    "@cipher/adapters",
    "@cipher/turnkey",
    "@cipher/rpc",
  ],
  serverExternalPackages: ["@turnkey/sdk-server"],
};

export default nextConfig;
