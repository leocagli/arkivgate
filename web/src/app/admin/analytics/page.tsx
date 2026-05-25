// /admin/analytics - metricas agregadas de interactions del proxy.
/* eslint-disable react/jsx-no-comment-textnodes */
import { getAdminSession } from "@/lib/admin-session";
import { getAnalytics } from "@/lib/analytics-server";
import { AnalyticsPanel } from "./_components/analytics-panel";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await getAdminSession();
  if (!session) return null;

  const initial = await getAnalytics({ orgId: session.orgId, range: "7d" });

  return (
    <section>
      <header className="mb-8 flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-wider text-graphite">
          // analiticas
        </span>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Lo que sucede en la organizacion.
        </h1>
        <p className="max-w-2xl text-graphite-dark">
          Metricas agregadas de cada request que paso por el proxy. Selecciona
          el rango de tiempo.
        </p>
      </header>
      <AnalyticsPanel initial={initial} />
    </section>
  );
}
