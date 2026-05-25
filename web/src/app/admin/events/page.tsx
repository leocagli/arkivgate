// /admin/events - live feed of proxy interactions.
/* eslint-disable react/jsx-no-comment-textnodes */
import { getAdminSession } from "@/lib/admin-session";
import { listEvents } from "@/lib/events";
import { EventsFeed } from "./_components/events-feed";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const session = await getAdminSession();
  if (!session) return null;

  const initialEvents = await listEvents({ orgId: session.orgId, limit: 100 });

  return (
    <section>
      <header className="mb-8 flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-wider text-graphite">
          // events
        </span>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          What is happening in real time.
        </h1>
        <p className="max-w-2xl text-graphite-dark">
          Every Claude Code request that passes through the proxy. Polling every
          3 seconds, without reload.
        </p>
      </header>
      <EventsFeed initialEvents={initialEvents} />
    </section>
  );
}
