/* eslint-disable react/jsx-no-comment-textnodes */

import { ensureAdminSession } from "@/lib/admin-session";
import { listRuntimeApiKeys } from "@/lib/api-keys-server";
import { ApiKeysPanel } from "./_components/api-keys-panel";

export const dynamic = "force-dynamic";

function interceptorBaseUrl() {
  return process.env.ArkivGate_PROXY_URL || "https://<tu-interceptor-railway>.up.railway.app";
}

export default async function ApiKeysPage() {
  const session = await ensureAdminSession();
  if (!session) return null;

  const keys = await listRuntimeApiKeys(session.orgId);

  return (
    <section>
      <header className="mb-8 flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-wider text-graphite">
          // api keys
        </span>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Conecta ArkivGate a apps externas.
        </h1>
        <p className="max-w-2xl text-graphite-dark">
          Genera un secret runtime para que un sitio cliente, wallet, dApp o
          agente pueda pasar por el interceptor. El secret se muestra una sola
          vez; en la base solo queda el hash.
        </p>
      </header>

      <ApiKeysPanel
        initialKeys={keys}
        interceptorBaseUrl={interceptorBaseUrl()}
      />
    </section>
  );
}
