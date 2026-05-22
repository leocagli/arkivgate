import { hashCliToken } from "@/lib/cli-tokens";
import { prisma } from "@/lib/prisma";

function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

type Body = {
  token?: string;
};

export async function POST(request: Request) {
  const bridgeToken = process.env.ARKIV_BRIDGE_TOKEN;
  const headerToken = request.headers.get("x-arkiv-bridge-token");

  if (!bridgeToken || headerToken !== bridgeToken) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const token = body?.token?.trim();
  if (!token?.startsWith("tk_")) {
    return Response.json({ error: "invalid token" }, { status: 400 });
  }

  const tokenHash = hashCliToken(token);
  const row = await prisma.cliToken.findUnique({
    where: { tokenHash },
    include: {
      member: true,
    },
  });

  if (!row || row.revokedAt || !row.member) {
    return Response.json({ error: "unknown or revoked arkivgate token" }, { status: 401 });
  }

  void prisma.cliToken
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  const policies = await prisma.policy.findMany({
    where: { orgId: row.member.orgId, isActive: true },
    orderBy: [{ layer: "asc" }, { createdAt: "asc" }],
  });

  return Response.json({
    ok: true,
    caller: {
      memberId: row.member.id,
      orgId: row.member.orgId,
      email: row.member.email,
    },
    policies: policies.map((policy) => ({
      id: policy.id,
      slug: policy.slug,
      domain: policy.domain,
      layer: policy.layer,
      rule: policy.rule,
      pattern: policy.pattern,
      defaultAction: policy.defaultAction,
      severity: policy.severity,
      source: policy.source,
      isActive: policy.isActive,
      createdAt: policy.createdAt.toISOString(),
      updatedAt: policy.updatedAt.toISOString(),
    })),
  });
}