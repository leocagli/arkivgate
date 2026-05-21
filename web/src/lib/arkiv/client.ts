import { createPublicClient, createWalletClient, http } from "@arkiv-network/sdk";
import { privateKeyToAccount } from "@arkiv-network/sdk/accounts";
import { braga } from "@arkiv-network/sdk/chains";

export function getArkivPublicClient() {
  return createPublicClient({
    chain: braga,
    transport: http(),
  });
}

export function getArkivWalletClient() {
  const privateKey = process.env.ARKIV_AGENT_PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey) {
    throw new Error("Missing ARKIV_AGENT_PRIVATE_KEY in environment");
  }

  return createWalletClient({
    chain: braga,
    transport: http(),
    account: privateKeyToAccount(privateKey),
  });
}
