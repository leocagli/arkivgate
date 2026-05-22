import { NextResponse } from "next/server";

import { POST as runSeed } from "@/app/api/admin/seed/route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expected = process.env.ARKIV_BRIDGE_TOKEN;
  const provided = request.headers.get("x-arkiv-bridge-token");

  if (!expected || provided !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  return runSeed();
}
