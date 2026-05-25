/* eslint-disable react/jsx-no-comment-textnodes */

import { ArkivPanel } from "./_components/arkiv-panel";

export const dynamic = "force-dynamic";

export default function AdminArkivPage() {
  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-wider text-graphite">
          // arkiv
        </span>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          On-chain evidence for the MVP.
        </h1>
        <p className="max-w-2xl text-graphite-dark">
          This view connects the frontend with Arkiv admin endpoints to validate
          entity writes and query firewall evidence.
        </p>
      </header>

      <ArkivPanel />
    </section>
  );
}
