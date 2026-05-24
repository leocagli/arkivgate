import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    resolveAlias: {
      accounts: "./src/lib/wallet/accounts-stub.ts",
    },
  },
};

export default nextConfig;
