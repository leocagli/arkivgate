"use client";

import { useState } from "react";
import { useAppKitProvider } from "@reown/appkit/react";

import { createWalletOwnedAgentProfile } from "@/lib/arkiv/browser-write";
import { entityExplorerUrl, transactionExplorerUrl } from "@/lib/arkiv/queries";
import { shortWalletAddress } from "@/lib/wallet/identity";
import {
  asEthereumProvider,
  getInjectedEthereumProvider,
  type EthereumProvider,
} from "@/lib/wallet/provider";
import { hasWalletConnectProjectId } from "./web3-providers";
import { useWalletIdentity, WalletIdentityButton } from "./wallet-identity-button";

type WriteState =
  | { status: "idle" }
  | { status: "writing" }
  | { status: "success"; entityKey: string; txHash: string }
  | { status: "error"; message: string };

export function WalletOwnedProfile() {
  if (hasWalletConnectProjectId()) return <ReownWalletOwnedProfile />;
  return <InjectedWalletOwnedProfile />;
}

function ReownWalletOwnedProfile() {
  const { walletProvider } = useAppKitProvider<unknown>("eip155");
  return <WalletOwnedProfileInner provider={asEthereumProvider(walletProvider)} />;
}

function InjectedWalletOwnedProfile() {
  return <WalletOwnedProfileInner provider={getInjectedEthereumProvider()} />;
}

function WalletOwnedProfileInner({ provider }: { provider: EthereumProvider | null }) {
  const wallet = useWalletIdentity();
  const [writeState, setWriteState] = useState<WriteState>({ status: "idle" });

  async function createProfile() {
    if (!wallet.address) {
      setWriteState({ status: "error", message: "connect wallet first" });
      return;
    }
    if (!provider) {
      setWriteState({ status: "error", message: "wallet provider unavailable" });
      return;
    }

    setWriteState({ status: "writing" });
    try {
      const result = await createWalletOwnedAgentProfile({
        provider,
        walletAddress: wallet.address,
      });
      setWriteState({
        status: "success",
        entityKey: result.entityKey,
        txHash: result.txHash,
      });
    } catch (error) {
      setWriteState({
        status: "error",
        message: error instanceof Error ? error.message : "wallet write failed",
      });
    }
  }

  return (
    <section id="ownership" className="border-y border-[#174a53]/15 bg-[#f7fbfa]">
      <div className="mx-auto grid w-full max-w-6xl gap-5 px-6 py-14 md:grid-cols-[0.9fr_1.1fr] md:py-16">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#1b5a65]">
            wallet-owned arkiv data
          </p>
          <h2 className="mt-2 text-2xl font-semibold md:text-3xl">
            El agente tambien puede escribir como owner.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-graphite-dark md:text-base">
            El runtime backend sigue escribiendo evidencia operativa. Esta accion separada crea
            un `agent_profile` desde la wallet conectada, con el mismo `PROJECT_ATTRIBUTE`.
            En Arkiv, esa entidad queda con `$owner` y `$creator` del usuario.
          </p>
        </div>

        <div className="border border-[#1b5a65]/20 bg-white p-4" style={{ borderRadius: "6px" }}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite">
                connected owner
              </p>
              <p className="mt-1 break-all font-mono text-sm text-[#123c45]">
                {wallet.address ? shortWalletAddress(wallet.address, 10) : "not connected"}
              </p>
            </div>
            <WalletIdentityButton />
          </div>

          <button
            type="button"
            onClick={() => void createProfile()}
            disabled={writeState.status === "writing" || !wallet.address}
            className="border border-[#1b5a65]/25 bg-[#1b5a65] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#144a53] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderRadius: "6px" }}
          >
            {writeState.status === "writing" ? "signing arkiv tx..." : "create owned agent_profile"}
          </button>

          <div className="mt-4 border border-[#1b5a65]/15 bg-[#f7fbfa] p-3 text-sm" style={{ borderRadius: "6px" }}>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite">
              what gets stamped
            </p>
            <p className="mt-2 text-graphite-dark">
              `project=arkivgate-leocagli-2026`, `entityType=agent_profile`,
              `agentKey=&lt;wallet&gt;`, `ownerAddress=&lt;wallet&gt;`, `createdAt`.
            </p>
          </div>

          {writeState.status === "success" ? (
            <div className="mt-4 grid gap-2 text-sm">
              <a
                href={entityExplorerUrl(writeState.entityKey)}
                target="_blank"
                rel="noreferrer"
                className="break-all font-mono text-xs text-[#1b5a65] underline underline-offset-4"
              >
                entity {writeState.entityKey}
              </a>
              <a
                href={transactionExplorerUrl(writeState.txHash)}
                target="_blank"
                rel="noreferrer"
                className="break-all font-mono text-xs text-[#1b5a65] underline underline-offset-4"
              >
                tx {writeState.txHash}
              </a>
            </div>
          ) : null}

          {writeState.status === "error" ? (
            <p className="mt-3 text-sm text-[#8a2d2d]">{writeState.message}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
