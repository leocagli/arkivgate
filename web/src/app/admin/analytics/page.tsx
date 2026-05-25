// /admin/analytics - aggregate metrics from proxy interactions.
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
          // analytics
        </span>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          What is happening inside the organization.
        </h1>
        <p className="max-w-2xl text-graphite-dark">
          Aggregate metrics for every request that passed through the proxy.
          Select a time range to inspect enforcement activity.
        </p>
      </header>
      <AnalyticsPanel initial={initial} />
    </section>
  );
}
