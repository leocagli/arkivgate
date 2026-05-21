// GET /api/cli/me â€” recibe Authorization: Bearer tk_xxx y devuelve el
// member asociado. Usado por `npx ArkivGate whoami` y para validar token.

import { resolveCliCaller } from "@/lib/cli-auth";

export async function GET(request: Request) {
  const caller = await resolveCliCaller(request);
  if (!caller) {
    return Response.json({ error: "invalid token" }, { status: 401 });
  }
  return Response.json({
    member: {
      email: caller.email,
      role: caller.role,
      org: { id: caller.orgId, name: caller.orgName },
    },
  });
}

