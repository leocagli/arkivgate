// GET /api/admin/analytics?range=24h|7d|30d
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { getAnalytics } from "@/lib/analytics-server";

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const range = new URL(request.url).searchParams.get("range");
  const data = await getAnalytics({ orgId: session.orgId, range });

  return Response.json(data);
}
