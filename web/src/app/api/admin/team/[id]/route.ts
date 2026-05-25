// DELETE /api/admin/team/[id] - remove a member from the current org.
// The helper guards against deleting the last admin.
import type { NextRequest } from "next/server";
import { requireAdminRole } from "@/lib/admin-session";
import { deleteTeamMember } from "@/lib/team-server";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(
  _request: NextRequest,
  ctx: RouteParams,
) {
  const auth = await requireAdminRole();
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const { id } = await ctx.params;

  try {
    const deleted = await deleteTeamMember(session.orgId, id);
    if (!deleted) return Response.json({ error: "member no encontrado" }, { status: 404 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return Response.json({ error: message }, { status: 400 });
  }

  return new Response(null, { status: 204 });
}
