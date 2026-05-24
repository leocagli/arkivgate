export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export function asEthereumProvider(value: unknown): EthereumProvider | null {
  if (!value || typeof value !== "object") return null;
  const maybeProvider = value as Partial<EthereumProvider>;
  return typeof maybeProvider.request === "function" ? (maybeProvider as EthereumProvider) : null;
}

export function getInjectedEthereumProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return asEthereumProvider(window.ethereum);
}
