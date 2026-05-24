"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAppKit,
  useAppKitAccount,
  useAppKitNetwork,
  useDisconnect,
} from "@reown/appkit/react";

import { bragaNetwork, hasWalletConnectProjectId } from "./web3-providers";
import {
  shortWalletAddress,
  WALLET_IDENTITY_EVENT,
  WALLET_IDENTITY_STORAGE_KEY,
  walletAgentKey,
  type WalletIdentity,
} from "@/lib/wallet/identity";
import { getInjectedEthereumProvider } from "@/lib/wallet/provider";

const BRAGA_CHAIN_HEX = `0x${bragaNetwork.id.toString(16)}`;

function publishWalletIdentity(identity: WalletIdentity | null) {
  if (typeof window === "undefined") return;

  if (identity) {
    window.localStorage.setItem(WALLET_IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  } else {
    window.localStorage.removeItem(WALLET_IDENTITY_STORAGE_KEY);
  }

  window.dispatchEvent(new CustomEvent(WALLET_IDENTITY_EVENT, { detail: identity }));
}

function readWalletIdentity(): WalletIdentity | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(WALLET_IDENTITY_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WalletIdentity;
    return parsed.address ? parsed : null;
  } catch {
    return null;
  }
}

export function useWalletIdentity() {
  const [identity, setIdentity] = useState<WalletIdentity | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setIdentity(readWalletIdentity()), 0);

    function handleStorage(event: StorageEvent) {
      if (event.key === WALLET_IDENTITY_STORAGE_KEY) setIdentity(readWalletIdentity());
    }

    function handleWallet(event: Event) {
      setIdentity((event as CustomEvent<WalletIdentity | null>).detail ?? null);
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener(WALLET_IDENTITY_EVENT, handleWallet);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(WALLET_IDENTITY_EVENT, handleWallet);
    };
  }, []);

  return useMemo(
    () => ({
      ...identity,
      connected: Boolean(identity?.address),
      agentKey: walletAgentKey(identity?.address),
    }),
    [identity],
  );
}

export function WalletIdentityButton({ compact = false }: { compact?: boolean }) {
  if (hasWalletConnectProjectId()) return <ReownWalletButton compact={compact} />;
  return <InjectedWalletButton compact={compact} />;
}

function ReownWalletButton({ compact }: { compact: boolean }) {
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const { address, caipAddress, isConnected } = useAppKitAccount({ namespace: "eip155" });
  const { chainId } = useAppKitNetwork();

  useEffect(() => {
    if (!isConnected || !address) {
      publishWalletIdentity(null);
      return;
    }

    publishWalletIdentity({
      address,
      caipAddress,
      chainId,
      connector: "walletconnect",
    });
  }, [address, caipAddress, chainId, isConnected]);

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={() => void disconnect()}
        className="inline-flex items-center border border-[#174a53]/35 bg-[#e2eceb] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[#174a53] transition-colors hover:bg-[#d4e3e1]"
        style={{ borderRadius: "var(--radius)" }}
      >
        {compact ? shortWalletAddress(address, 4) : `wallet ${shortWalletAddress(address, 4)}`}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void open({ view: "Connect", namespace: "eip155" })}
      className="inline-flex items-center border border-[#174a53]/35 bg-paper px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[#174a53] transition-colors hover:bg-[#e2eceb]"
      style={{ borderRadius: "var(--radius)" }}
    >
      {compact ? "wallet" : "connect wallet"}
    </button>
  );
}

function InjectedWalletButton({ compact }: { compact: boolean }) {
  const [identity, setIdentity] = useState<WalletIdentity | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => setIdentity(readWalletIdentity()), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  async function connectInjectedWallet() {
    setError("");
    const provider = getInjectedEthereumProvider();
    if (!provider) {
      setError("no injected wallet");
      return;
    }

    try {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: BRAGA_CHAIN_HEX,
            chainName: bragaNetwork.name,
            nativeCurrency: bragaNetwork.nativeCurrency,
            rpcUrls: bragaNetwork.rpcUrls.default.http,
            blockExplorerUrls: [bragaNetwork.blockExplorers.default.url],
          },
        ],
      });
    } catch {
      // Wallets that already know the network or reject network addition can still connect.
    }

    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0];
      if (!address) throw new Error("wallet returned no account");
      const nextIdentity: WalletIdentity = {
        address,
        chainId: bragaNetwork.id,
        caipAddress: `eip155:${bragaNetwork.id}:${address}`,
        connector: "injected",
      };
      setIdentity(nextIdentity);
      publishWalletIdentity(nextIdentity);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "wallet rejected");
    }
  }

  function disconnectInjectedWallet() {
    setIdentity(null);
    publishWalletIdentity(null);
  }

  if (identity?.address) {
    return (
      <button
        type="button"
        onClick={disconnectInjectedWallet}
        className="inline-flex items-center border border-[#174a53]/35 bg-[#e2eceb] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[#174a53] transition-colors hover:bg-[#d4e3e1]"
        style={{ borderRadius: "var(--radius)" }}
        title="Disconnect local wallet identity"
      >
        {compact ? shortWalletAddress(identity.address, 4) : `wallet ${shortWalletAddress(identity.address, 4)}`}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void connectInjectedWallet()}
        className="inline-flex items-center border border-[#174a53]/35 bg-paper px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[#174a53] transition-colors hover:bg-[#e2eceb]"
        style={{ borderRadius: "var(--radius)" }}
      >
        {compact ? "wallet" : "connect wallet"}
      </button>
      {error ? <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#8a2d2d]">{error}</span> : null}
    </div>
  );
}
