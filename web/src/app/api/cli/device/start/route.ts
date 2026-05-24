// POST /api/cli/device/start
// Inicio del device flow. El CLI pega acÃ¡ ANTES de saber quiÃ©n es el user;
// no requiere auth. El backend genera device_code + user_code y los guarda
// con status=pending. El user despuÃ©s los aprueba desde el browser
// (post-login Google).
//
// Body opcional: { "org_id": "acme" } â€” si el dev corriÃ³ `npx ArkivGate
// setup --org-id acme`, lo guardamos en el device code para joinearlo a
// esa org cuando apruebe desde el browser.

import {
  DEVICE_CODE_TTL_MS,
  DEVICE_POLL_INTERVAL_S,
  generateDeviceCode,
  generateUserCode,
} from "@/lib/cli-tokens";
import { hasSupabaseRestConfig, supabaseRestFetch } from "@/lib/supabase-rest";

function appUrl(request: Request): string {
  return process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

function proxyUrl(): string {
  return (
    process.env.ArkivGate_PROXY_URL ??
    "https://arkivgate-production.up.railway.app"
  );
}

async function persistDeviceCode(input: {
  deviceCode: string;
  userCode: string;
  expiresAt: Date;
  orgInviteId: string | null;
}) {
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.cliDeviceCode.create({
      data: {
        deviceCode: input.deviceCode,
        userCode: input.userCode,
        expiresAt: input.expiresAt,
        status: "pending",
        orgInviteId: input.orgInviteId,
      },
    });
    return;
  } catch (err) {
    if (!hasSupabaseRestConfig()) {
      throw err;
    }
    console.warn("[cli-device-start] Prisma failed, falling back to Supabase REST:", err);
  }

  await supabaseRestFetch("/cli_device_codes", {
    method: "POST",
    body: JSON.stringify({
      device_code: input.deviceCode,
      user_code: input.userCode,
      expires_at: input.expiresAt.toISOString(),
      status: "pending",
      org_invite_id: input.orgInviteId,
    }),
  });
}

export async function POST(request: Request) {
  let orgInviteId: string | null = null;
  try {
    const body = (await request.json()) as { org_id?: unknown };
    if (typeof body?.org_id === "string" && body.org_id.trim()) {
      orgInviteId = body.org_id.trim();
    }
  } catch {
    // Body vacÃ­o o no-JSON: el CLI puede mandar POST sin body. No es error.
  }

  const deviceCode = generateDeviceCode();
  const userCode = generateUserCode();
  const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_MS);

  await persistDeviceCode({ deviceCode, userCode, expiresAt, orgInviteId });

  const verificationUri = `${appUrl(request)}/cli/connect?code=${encodeURIComponent(userCode)}`;

  return Response.json({
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: verificationUri,
    proxy_url: proxyUrl(),
    expires_in: Math.floor(DEVICE_CODE_TTL_MS / 1000),
    interval: DEVICE_POLL_INTERVAL_S,
  });
}

