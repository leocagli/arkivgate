import type { NextRequest } from "next/server";
import { getAdminSession, requireAdminRole } from "@/lib/admin-session";
import { createRuntimeApiKey, listRuntimeApiKeys } from "@/lib/api-keys-server";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const keys = await listRuntimeApiKeys(session.orgId);
  return Response.json({ keys });
}

type CreateBody = {
  label?: unknown;
};

export async function POST(request: NextRequest) {
  const auth = await requireAdminRole();
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const body = (await request.json().catch(() => ({}))) as CreateBody;
  const label = typeof body.label === "string" ? body.label : null;

  const result = await createRuntimeApiKey({
    orgId: session.orgId,
    email: session.email,
    label,
  });

  return Response.json(result, { status: 201 });
}
