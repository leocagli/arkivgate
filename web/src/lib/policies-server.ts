import { prisma } from "@/lib/prisma";
import {
  toRuleDTO,
  type PolicyDomain,
  type RuleDTO,
  type Severity,
} from "@/lib/policies";
import { hasSupabaseRestConfig, restEq, supabaseRestFetch } from "@/lib/supabase-rest";

type RestPolicy = {
  id: string;
  slug: string;
  domain: PolicyDomain;
  layer: RuleDTO["layer"];
  rule: string;
  default_action: RuleDTO["defaultAction"];
  severity: Severity;
  source: RuleDTO["source"] | "ai-suggestor" | "google-workspace";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function restPolicyToDTO(p: RestPolicy): RuleDTO {
  return {
    id: p.id,
    slug: p.slug,
    domain: p.domain,
    layer: p.layer,
    rule: p.rule,
    defaultAction: p.default_action,
    severity: p.severity,
    source: p.source === "ai-suggestor" ? "ai_suggestor" : p.source === "google-workspace" ? "admin" : p.source,
    isActive: p.is_active,
    createdAt: new Date(p.created_at).toISOString(),
    updatedAt: new Date(p.updated_at).toISOString(),
  };
}

async function listRulesWithRest(orgId: string): Promise<RuleDTO[]> {
  const rows = await supabaseRestFetch<RestPolicy[]>(
    `/policies?select=id,slug,domain,layer,rule,default_action,severity,source,is_active,created_at,updated_at&org_id=eq.${restEq(orgId)}&order=is_active.desc,created_at.desc`,
  );
  return rows.map(restPolicyToDTO);
}

export async function listRules(orgId: string): Promise<RuleDTO[]> {
  try {
    const rows = await prisma.policy.findMany({
      where: { orgId },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toRuleDTO);
  } catch (err) {
    if (!hasSupabaseRestConfig()) throw err;
    console.warn("[policies] Prisma list failed, falling back to Supabase REST:", err);
    return listRulesWithRest(orgId);
  }
}

export async function createRule(input: {
  orgId: string;
  slug: string;
  domain: PolicyDomain;
  layer: RuleDTO["layer"];
  rule: string;
  defaultAction: RuleDTO["defaultAction"];
  severity: Severity;
  source: "admin" | "seed" | "ai_suggestor";
}): Promise<RuleDTO> {
  try {
    const created = await prisma.policy.create({
      data: {
        orgId: input.orgId,
        slug: input.slug,
        domain: input.domain,
        layer: input.layer,
        rule: input.rule,
        defaultAction: input.defaultAction,
        severity: input.severity,
        source: input.source,
        isActive: true,
      },
    });
    return toRuleDTO(created);
  } catch (err) {
    if (!hasSupabaseRestConfig()) throw err;
    console.warn("[policies] Prisma create failed, falling back to Supabase REST:", err);
    const rows = await supabaseRestFetch<RestPolicy[]>("/policies", {
      method: "POST",
      body: JSON.stringify({
        org_id: input.orgId,
        slug: input.slug,
        domain: input.domain,
        layer: input.layer,
        rule: input.rule,
        default_action: input.defaultAction,
        severity: input.severity,
        source: input.source === "ai_suggestor" ? "ai-suggestor" : input.source,
        is_active: true,
      }),
    });
    const rule = rows[0];
    if (!rule) throw new Error("Supabase did not return created policy");
    return restPolicyToDTO(rule);
  }
}
