// GET /api/admin/events?since=<iso>&action=<BLOCK|...>&limit=<n>
// Polling-friendly: pasale `since` con el `createdAt` del último evento que
// ya tenés y devuelve solo los nuevos.
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { listEvents } from "@/lib/events";

const ALLOWED_ACTIONS = ["BLOCK", "REDACT", "WARN", "LOG"] as const;

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);

  const sinceRaw = url.searchParams.get("since");
  const since = sinceRaw ? new Date(sinceRaw) : null;
  const sinceValid = since && !Number.isNaN(since.getTime()) ? since : null;

  const actionRaw = url.searchParams.get("action");
  const action =
    actionRaw && (ALLOWED_ACTIONS as readonly string[]).includes(actionRaw)
      ? (actionRaw as (typeof ALLOWED_ACTIONS)[number])
      : null;

  const limitRaw = Number(url.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;

  const events = await listEvents({
    orgId: session.orgId,
    since: sinceValid,
    action,
    limit,
  });

  return Response.json({ events });
}
