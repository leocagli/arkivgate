import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  reactCompiler: true,
  turbopack: {
    resolveAlias: {
      accounts: "./src/lib/wallet/accounts-stub.ts",
    },
  },
};

export default nextConfig;
