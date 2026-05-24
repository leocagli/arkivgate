export type WalletIdentity = {
  address: string;
  caipAddress?: string;
  chainId?: string | number;
  connector: "walletconnect" | "injected";
};

export const WALLET_IDENTITY_STORAGE_KEY = "arkivgate.wallet.identity";
export const WALLET_IDENTITY_EVENT = "arkivgate-wallet-identity";

export function shortWalletAddress(value?: string | null, chars = 6): string {
  if (!value) return "-";
  if (value.length <= chars * 2 + 3) return value;
  return `${value.slice(0, chars)}...${value.slice(-chars)}`;
}

export function walletAgentKey(address?: string | null): string | null {
  return address ? address.toLowerCase() : null;
}
