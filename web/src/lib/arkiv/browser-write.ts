"use client";

import { createWalletClient, custom } from "@arkiv-network/sdk";
import { braga } from "@arkiv-network/sdk/chains";

import { buildAgentProfileEntity } from "./entities";
import type { EthereumProvider } from "@/lib/wallet/provider";

export async function createWalletOwnedAgentProfile(input: {
  provider: EthereumProvider;
  walletAddress: string;
  orgKey?: string;
}) {
  const walletClient = createWalletClient({
    chain: braga,
    transport: custom(input.provider),
  });

  return walletClient.createEntity(
    buildAgentProfileEntity({
      orgKey: input.orgKey ?? "demo",
      walletAddress: input.walletAddress,
    }),
  );
}
