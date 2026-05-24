"use client";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { defineChain } from "@reown/appkit/networks";
import { WagmiProvider } from "wagmi";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export const bragaNetwork = defineChain({
  id: 60_138_453_102,
  caipNetworkId: "eip155:60138453102",
  chainNamespace: "eip155",
  name: "Arkiv Braga",
  nativeCurrency: {
    decimals: 18,
    name: "GLM",
    symbol: "GLM",
  },
  rpcUrls: {
    default: {
      http: ["https://braga.hoodi.arkiv.network/rpc"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arkiv Braga Explorer",
      url: "https://explorer.braga.hoodi.arkiv.network",
    },
  },
});

const networks = [bragaNetwork] as [typeof bragaNetwork, ...Array<typeof bragaNetwork>];
const queryClient = new QueryClient();

const wagmiAdapter = projectId
  ? new WagmiAdapter({
      ssr: true,
      projectId,
      networks,
    })
  : null;

const globalAppKit = globalThis as typeof globalThis & {
  __arkivgateAppKitInitialized?: boolean;
};

if (projectId && wagmiAdapter && !globalAppKit.__arkivgateAppKitInitialized) {
  createAppKit({
    adapters: [wagmiAdapter],
    projectId,
    networks,
    defaultNetwork: bragaNetwork,
    metadata: {
      name: "ArkivGate",
      description: "Paid AI agent policy runtime with Arkiv evidence.",
      url: "https://arkivgate.vercel.app",
      icons: ["https://arkivgate.vercel.app/logo.svg"],
    },
    features: {
      analytics: false,
      email: false,
      socials: false,
    },
  });
  globalAppKit.__arkivgateAppKitInitialized = true;
}

export function Web3Providers({ children }: { children: ReactNode }) {
  if (!wagmiAdapter) return <>{children}</>;

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

export function hasWalletConnectProjectId() {
  return Boolean(projectId);
}
