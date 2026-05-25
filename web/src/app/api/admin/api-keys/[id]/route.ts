import type { NextRequest } from "next/server";
import { requireAdminRole } from "@/lib/admin-session";
import { revokeRuntimeApiKey } from "@/lib/api-keys-server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRole();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const removed = await revokeRuntimeApiKey({
    orgId: auth.session.orgId,
    id,
  });
  if (!removed) return Response.json({ error: "not found" }, { status: 404 });

  return Response.json({ ok: true });
}
