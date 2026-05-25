// /api/admin/team — listar y agregar members de la org del admin logueado.
// Solo admins pueden modificar (los dev no tienen acceso al back-office por
// ahora, pero gateamos igual por defensa).
import type { NextRequest } from "next/server";
import { getAdminSession, requireAdminRole } from "@/lib/admin-session";
import { isValidEmail } from "@/lib/team";
import { createTeamMember, listTeamMembers } from "@/lib/team-server";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const members = await listTeamMembers(session.orgId);
  return Response.json({ members });
}

type CreateBody = {
  email?: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireAdminRole();
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const body = (await request.json().catch(() => null)) as CreateBody | null;
  const email = (body?.email ?? "").trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return Response.json({ error: "email inválido" }, { status: 400 });
  }

  try {
    const member = await createTeamMember({
      orgId: session.orgId,
      email,
      role: "dev",
    });
    return Response.json({ member }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    if (message.includes("Unique constraint")) {
      return Response.json(
        { error: `ya existe un member con email "${email}" en esta org` },
        { status: 409 },
      );
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
