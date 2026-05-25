import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hasSupabaseRestConfig, restEq, supabaseRestFetch } from "@/lib/supabase-rest";
import { toMemberDTO, type MemberDTO } from "@/lib/team";

type RestMember = {
  id: string;
  org_id: string;
  email: string;
  role: "admin" | "dev";
  user_id: string | null;
  created_at: string;
};

function restMemberToDTO(member: RestMember): MemberDTO {
  return {
    id: member.id,
    email: member.email,
    role: member.role,
    linkedAt: member.user_id ? new Date(0).toISOString() : null,
    createdAt: new Date(member.created_at).toISOString(),
  };
}

async function listMembersWithRest(orgId: string): Promise<MemberDTO[]> {
  const rows = await supabaseRestFetch<RestMember[]>(
    `/members?select=id,org_id,email,role,user_id,created_at&org_id=eq.${restEq(orgId)}&order=role.asc,created_at.asc`,
  );
  return rows.map(restMemberToDTO);
}

async function createMemberWithRest(input: {
  orgId: string;
  email: string;
  role: "admin" | "dev";
}): Promise<MemberDTO> {
  const rows = await supabaseRestFetch<RestMember[]>("/members", {
    method: "POST",
    body: JSON.stringify({
      id: randomUUID(),
      org_id: input.orgId,
      email: input.email,
      role: input.role,
    }),
  });
  const member = rows[0];
  if (!member) throw new Error("Supabase did not return created member");
  return restMemberToDTO(member);
}

async function getMemberWithRest(orgId: string, id: string): Promise<RestMember | null> {
  const rows = await supabaseRestFetch<RestMember[]>(
    `/members?select=id,org_id,email,role,user_id,created_at&id=eq.${restEq(id)}&org_id=eq.${restEq(orgId)}&limit=1`,
  );
  return rows[0] ?? null;
}

async function countAdminsWithRest(orgId: string): Promise<number> {
  const rows = await supabaseRestFetch<{ id: string }[]>(
    `/members?select=id&org_id=eq.${restEq(orgId)}&role=eq.admin`,
  );
  return rows.length;
}

async function deleteMemberWithRest(orgId: string, id: string): Promise<boolean> {
  const target = await getMemberWithRest(orgId, id);
  if (!target) return false;
  if (target.role === "admin" && (await countAdminsWithRest(orgId)) <= 1) {
    throw new Error("no podés eliminar al único admin de la org");
  }
  await supabaseRestFetch(`/members?id=eq.${restEq(id)}&org_id=eq.${restEq(orgId)}`, {
    method: "DELETE",
  });
  return true;
}

export async function listTeamMembers(orgId: string): Promise<MemberDTO[]> {
  try {
    const rows = await prisma.member.findMany({
      where: { orgId },
      include: { user: { select: { emailVerified: true } } },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toMemberDTO);
  } catch (err) {
    if (!hasSupabaseRestConfig()) throw err;
    console.warn("[team] Prisma list failed, falling back to Supabase REST:", err);
    return listMembersWithRest(orgId);
  }
}

export async function createTeamMember(input: {
  orgId: string;
  email: string;
  role: "admin" | "dev";
}): Promise<MemberDTO> {
  try {
    const created = await prisma.member.create({
      data: {
        orgId: input.orgId,
        email: input.email,
        role: input.role,
      },
      include: { user: { select: { emailVerified: true } } },
    });
    return toMemberDTO(created);
  } catch (err) {
    if (!hasSupabaseRestConfig()) throw err;
    console.warn("[team] Prisma create failed, falling back to Supabase REST:", err);
    return createMemberWithRest(input);
  }
}

export async function deleteTeamMember(orgId: string, id: string): Promise<boolean> {
  try {
    const target = await prisma.member.findFirst({ where: { id, orgId } });
    if (!target) return false;

    if (target.role === "admin") {
      const adminCount = await prisma.member.count({
        where: { orgId, role: "admin" },
      });
      if (adminCount <= 1) {
        throw new Error("no podés eliminar al único admin de la org");
      }
    }

    await prisma.member.delete({ where: { id } });
    return true;
  } catch (err) {
    if (!hasSupabaseRestConfig()) throw err;
    console.warn("[team] Prisma delete failed, falling back to Supabase REST:", err);
    return deleteMemberWithRest(orgId, id);
  }
}
