// /admin/team - member list + developer invite form.
/* eslint-disable react/jsx-no-comment-textnodes */

import { ensureAdminSession } from "@/lib/admin-session";
import { listTeamMembers } from "@/lib/team-server";
import { TeamPanel } from "./_components/team-panel";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await ensureAdminSession();
  if (!session) return null;

  const initial = await listTeamMembers(session.orgId);

  return (
    <section>
      <header className="mb-8 flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-wider text-graphite">
          // team
        </span>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Who can pass through ArkivGate in your org.
        </h1>
        <p className="max-w-2xl text-graphite-dark">
          Add developers by email so they are pre-associated before first login,
          or share the command with your{" "}
          <code className="font-mono text-sm">org-id</code> so they can join
          from the CLI.
        </p>
      </header>
      <TeamPanel
        initialMembers={initial}
        currentEmail={session.email}
        orgId={session.orgId}
      />
    </section>
  );
}
