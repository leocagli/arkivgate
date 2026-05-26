import type { NextRequest } from "next/server";
import { ensureAdminSession, getAdminSession } from "@/lib/admin-session";
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
  const session = await ensureAdminSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "admin") return Response.json({ error: "forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as CreateBody;
  const label = typeof body.label === "string" ? body.label : null;

  try {
    const result = await createRuntimeApiKey({
      orgId: session.orgId,
      email: session.email,
      label,
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error: "could not create the API key",
        detail: error instanceof Error ? error.message : "unknown error",
      },
      { status: 500 },
    );
  }
}
