import { generateCliToken, hashCliToken } from "@/lib/cli-tokens";
import { prisma } from "@/lib/prisma";
import { hasSupabaseRestConfig, restEq, supabaseRestFetch } from "@/lib/supabase-rest";

export type RuntimeApiKeyDTO = {
  id: string;
  label: string | null;
  ownerEmail: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type RestMember = {
  id: string;
  email: string;
  role: "admin" | "dev";
  org_id: string;
};

type RestCliToken = {
  id: string;
  member_id: string;
  label: string | null;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

function tokenToDTO(row: {
  id: string;
  label: string | null;
  lastUsedAt?: Date | string | null;
  last_used_at?: string | null;
  createdAt?: Date | string;
  created_at?: string;
  revokedAt?: Date | string | null;
  revoked_at?: string | null;
  member?: { email: string };
  ownerEmail?: string;
}): RuntimeApiKeyDTO {
  const createdAt = row.createdAt ?? row.created_at;
  const lastUsedAt = row.lastUsedAt ?? row.last_used_at ?? null;
  const revokedAt = row.revokedAt ?? row.revoked_at ?? null;
  return {
    id: row.id,
    label: row.label,
    ownerEmail: row.member?.email ?? row.ownerEmail ?? "unknown",
    createdAt:
      createdAt instanceof Date
        ? createdAt.toISOString()
        : new Date(createdAt ?? Date.now()).toISOString(),
    lastUsedAt:
      lastUsedAt instanceof Date
        ? lastUsedAt.toISOString()
        : lastUsedAt
          ? new Date(lastUsedAt).toISOString()
          : null,
    revokedAt:
      revokedAt instanceof Date
        ? revokedAt.toISOString()
        : revokedAt
          ? new Date(revokedAt).toISOString()
          : null,
  };
}

function idsFilter(ids: string[]): string {
  return ids.map((id) => encodeURIComponent(id)).join(",");
}

async function listOrgMembersWithRest(orgId: string): Promise<RestMember[]> {
  return supabaseRestFetch<RestMember[]>(
    `/members?select=id,email,role,org_id&org_id=eq.${restEq(orgId)}`,
  );
}

async function getOrCreateMemberWithRest(input: {
  orgId: string;
  email: string;
}): Promise<RestMember> {
  const existing = await supabaseRestFetch<RestMember[]>(
    `/members?select=id,email,role,org_id&org_id=eq.${restEq(input.orgId)}&email=eq.${restEq(input.email)}&limit=1`,
  );
  if (existing[0]) return existing[0];

  const created = await supabaseRestFetch<RestMember[]>("/members", {
    method: "POST",
    body: JSON.stringify({
      org_id: input.orgId,
      email: input.email,
      role: "admin",
    }),
  });
  const member = created[0];
  if (!member) throw new Error("Supabase did not return created member");
  return member;
}

async function listRuntimeApiKeysWithRest(orgId: string): Promise<RuntimeApiKeyDTO[]> {
  const members = await listOrgMembersWithRest(orgId);
  if (members.length === 0) return [];
  const memberById = new Map(members.map((member) => [member.id, member]));
  const rows = await supabaseRestFetch<RestCliToken[]>(
    `/cli_tokens?select=id,member_id,label,last_used_at,created_at,revoked_at&member_id=in.(${idsFilter(members.map((m) => m.id))})&order=created_at.desc`,
  );
  return rows.map((row) =>
    tokenToDTO({
      ...row,
      ownerEmail: memberById.get(row.member_id)?.email,
    }),
  );
}

export async function listRuntimeApiKeys(orgId: string): Promise<RuntimeApiKeyDTO[]> {
  try {
    const rows = await prisma.cliToken.findMany({
      where: { member: { orgId } },
      include: { member: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(tokenToDTO);
  } catch (err) {
    if (!hasSupabaseRestConfig()) throw err;
    console.warn("[api-keys] Prisma list failed, falling back to Supabase REST:", err);
    return listRuntimeApiKeysWithRest(orgId);
  }
}

export async function createRuntimeApiKey(input: {
  orgId: string;
  email: string;
  label?: string | null;
}): Promise<{ key: RuntimeApiKeyDTO; secret: string }> {
  const secret = generateCliToken();
  const tokenHash = hashCliToken(secret);
  const label = input.label?.trim() || `Runtime API - ${new Date().toISOString().slice(0, 10)}`;

  try {
    let member = await prisma.member.findFirst({
      where: { orgId: input.orgId, email: input.email },
    });
    member ??= await prisma.member.create({
      data: { orgId: input.orgId, email: input.email, role: "admin" },
    });
    const created = await prisma.cliToken.create({
      data: {
        memberId: member.id,
        tokenHash,
        label,
      },
      include: { member: { select: { email: true } } },
    });
    return { key: tokenToDTO(created), secret };
  } catch (err) {
    if (!hasSupabaseRestConfig()) throw err;
    console.warn("[api-keys] Prisma create failed, falling back to Supabase REST:", err);
    const member = await getOrCreateMemberWithRest({
      orgId: input.orgId,
      email: input.email,
    });
    const rows = await supabaseRestFetch<RestCliToken[]>("/cli_tokens", {
      method: "POST",
      body: JSON.stringify({
        member_id: member.id,
        token_hash: tokenHash,
        label,
      }),
    });
    const row = rows[0];
    if (!row) throw new Error("Supabase did not return created API key");
    return {
      key: tokenToDTO({ ...row, ownerEmail: member.email }),
      secret,
    };
  }
}

export async function revokeRuntimeApiKey(input: {
  orgId: string;
  id: string;
}): Promise<boolean> {
  try {
    const target = await prisma.cliToken.findFirst({
      where: { id: input.id, member: { orgId: input.orgId } },
    });
    if (!target) return false;
    await prisma.cliToken.update({
      where: { id: input.id },
      data: { revokedAt: new Date() },
    });
    return true;
  } catch (err) {
    if (!hasSupabaseRestConfig()) throw err;
    console.warn("[api-keys] Prisma revoke failed, falling back to Supabase REST:", err);
    const members = await listOrgMembersWithRest(input.orgId);
    if (members.length === 0) return false;
    await supabaseRestFetch(
      `/cli_tokens?id=eq.${restEq(input.id)}&member_id=in.(${idsFilter(members.map((m) => m.id))})`,
      {
        method: "PATCH",
        body: JSON.stringify({ revoked_at: new Date().toISOString() }),
      },
    );
    return true;
  }
}
