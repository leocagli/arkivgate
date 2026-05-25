// /admin/team — lista de members + form para invitar dev por email.
// El dev queda creado con `userId=null` y se linkea apenas loguee con
// Google (lib/org-resolution.ts).
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
          // equipo
        </span>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Quién pasa por ArkivGate en tu org.
        </h1>
        <p className="max-w-2xl text-graphite-dark">
          Tenés dos formas de sumar devs: invitarlos por email (quedan
          pre-asociados antes del primer login), o pasarles el comando con tu{" "}
          <code className="font-mono text-sm">org-id</code> para que se
          autoadhieran desde el CLI.
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
