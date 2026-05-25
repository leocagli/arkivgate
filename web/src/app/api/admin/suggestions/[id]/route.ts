import { requireAdminRole } from "@/lib/admin-session";
import { decideSuggestion } from "@/lib/suggestions-server";
import { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminRole();
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const { id } = await params;
  const { action, rejectReason } = await request.json();

  if (action !== "accept" && action !== "reject") {
    return Response.json({ error: "action must be accept or reject" }, { status: 400 });
  }

  try {
    const result = await decideSuggestion({
      orgId: session.orgId,
      id,
      action,
      rejectReason,
    });
    return Response.json({ ok: true, policyId: result.policyId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    if (message === "not found") {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    if (message.includes("procesada")) {
      return Response.json({ error: message }, { status: 409 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
