// GET /api/cli/device/poll?device_code=...
// El CLI hace polling acá. Cuando el user aprueba en el browser, devolvemos
// el token plaintext UNA sola vez y limpiamos secretToken.

import type { NextRequest } from "next/server";
import { hasSupabaseRestConfig, restEq, supabaseRestFetch } from "@/lib/supabase-rest";

type RestDeviceCode = {
  device_code: string;
  user_code: string;
  member_id: string | null;
  status: string;
  expires_at: string;
  secret_token: string | null;
};

type RestMember = {
  id: string;
  email: string;
  role: string;
  org_id: string;
};

type RestOrganization = {
  id: string;
  name: string;
};

type PrismaDeviceCode = {
  status: string;
  expiresAt: Date;
  secretToken: string | null;
  member: {
    email: string;
    role: string;
    organization: {
      id: string;
      name: string;
    };
  } | null;
};

async function pollWithSupabaseRest(deviceCode: string) {
  const rows = await supabaseRestFetch<RestDeviceCode[]>(
    `/cli_device_codes?select=device_code,user_code,member_id,status,expires_at,secret_token&device_code=eq.${restEq(deviceCode)}&limit=1`,
  );
  const code = rows[0];

  if (!code) {
    return Response.json({ error: "unknown device code" }, { status: 404 });
  }

  if (code.status === "pending" && new Date(code.expires_at).getTime() < Date.now()) {
    await supabaseRestFetch(`/cli_device_codes?device_code=eq.${restEq(deviceCode)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "expired" }),
    });
    return Response.json({ status: "expired" });
  }

  if (code.status === "pending") {
    return Response.json({ status: "pending" });
  }

  if (code.status === "approved") {
    if (!code.secret_token || !code.member_id) {
      return Response.json({ status: "consumed" }, { status: 410 });
    }

    const token = code.secret_token;
    await supabaseRestFetch(`/cli_device_codes?device_code=eq.${restEq(deviceCode)}`, {
      method: "PATCH",
      body: JSON.stringify({ secret_token: null }),
    });

    const memberRows = await supabaseRestFetch<RestMember[]>(
      `/members?select=id,email,role,org_id&id=eq.${restEq(code.member_id)}&limit=1`,
    );
    const member = memberRows[0];
    if (!member) {
      return Response.json({ error: "dangling token" }, { status: 401 });
    }

    const orgRows = await supabaseRestFetch<RestOrganization[]>(
      `/organizations?select=id,name&id=eq.${restEq(member.org_id)}&limit=1`,
    );
    const org = orgRows[0] ?? { id: member.org_id, name: member.org_id };

    return Response.json({
      status: "approved",
      token,
      member: {
        email: member.email,
        role: member.role,
        org,
      },
    });
  }

  return Response.json({ status: code.status });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const deviceCode = url.searchParams.get("device_code");
  if (!deviceCode) {
    return Response.json({ error: "missing device_code" }, { status: 400 });
  }

  let code: PrismaDeviceCode | null;
  let prisma: typeof import("@/lib/prisma").prisma;
  try {
    ({ prisma } = await import("@/lib/prisma"));
    code = await prisma.cliDeviceCode.findUnique({
      where: { deviceCode },
      include: {
        member: {
          select: {
            email: true,
            role: true,
            orgId: true,
            organization: { select: { id: true, name: true } },
          },
        },
      },
    });
  } catch (err) {
    if (!hasSupabaseRestConfig()) {
      throw err;
    }
    console.warn("[cli-device-poll] Prisma failed, falling back to Supabase REST:", err);
    return pollWithSupabaseRest(deviceCode);
  }

  if (!code) {
    return Response.json({ error: "unknown device code" }, { status: 404 });
  }

  // Expirado por TTL. Marcamos para que el siguiente poll vea el estado real.
  if (code.status === "pending" && code.expiresAt.getTime() < Date.now()) {
    await prisma.cliDeviceCode.update({
      where: { deviceCode },
      data: { status: "expired" },
    });
    return Response.json({ status: "expired" });
  }

  if (code.status === "pending") {
    return Response.json({ status: "pending" });
  }

  if (code.status === "approved") {
    if (!code.secretToken || !code.member) {
      // Approved pero ya recogido — el cliente esperó demasiado entre polls.
      return Response.json({ status: "consumed" }, { status: 410 });
    }
    const token = code.secretToken;
    // Borramos el plaintext para que solo se entregue una vez.
    await prisma.cliDeviceCode.update({
      where: { deviceCode },
      data: { secretToken: null },
    });
    return Response.json({
      status: "approved",
      token,
      member: {
        email: code.member.email,
        role: code.member.role,
        org: {
          id: code.member.organization.id,
          name: code.member.organization.name,
        },
      },
    });
  }

  return Response.json({ status: code.status });
}
