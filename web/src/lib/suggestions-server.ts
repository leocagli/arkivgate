import { prisma } from "@/lib/prisma";
import { hasSupabaseRestConfig, restEq, supabaseRestFetch } from "@/lib/supabase-rest";

export type SuggestionDTO = {
  id: string;
  proposedSlug: string;
  proposedDomain: string;
  proposedLayer: string;
  proposedRule: string;
  proposedPattern: string | null;
  proposedAction: string;
  proposedSeverity: string;
  sourceHint: string | null;
  status: string;
  matchCount: number;
  examples: unknown;
  createdAt: string;
};

export type CurrentRuleDTO = {
  slug: string;
  domain: string;
  layer: string;
  rule: string;
  pattern: string | null;
  action: string;
  severity: string;
  isActive: boolean;
};

type RestSuggestion = {
  id: string;
  proposed_slug: string;
  proposed_domain: string;
  proposed_layer: string;
  proposed_rule: string;
  proposed_pattern: string | null;
  proposed_match_config?: unknown;
  proposed_action: string;
  proposed_severity: string;
  source_hint: string | null;
  status: string;
  match_count: number;
  examples: unknown;
  created_at: string;
};

type RestPolicy = {
  id: string;
  slug: string;
  domain: string;
  layer: string;
  rule: string;
  pattern: string | null;
  match_config?: unknown;
  default_action: string;
  severity: string;
  is_active: boolean;
};

function toSuggestionDTO(row: {
  id: string;
  proposedSlug: string;
  proposedDomain: string;
  proposedLayer: string;
  proposedRule: string;
  proposedPattern: string | null;
  proposedAction: string;
  proposedSeverity: string;
  sourceHint: string | null;
  status: string;
  matchCount: number;
  examples: unknown;
  createdAt: Date | string;
}): SuggestionDTO {
  return {
    id: row.id,
    proposedSlug: row.proposedSlug,
    proposedDomain: row.proposedDomain,
    proposedLayer: row.proposedLayer,
    proposedRule: row.proposedRule,
    proposedPattern: row.proposedPattern,
    proposedAction: row.proposedAction,
    proposedSeverity: row.proposedSeverity,
    sourceHint: row.sourceHint,
    status: row.status,
    matchCount: row.matchCount,
    examples: row.examples,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : new Date(row.createdAt).toISOString(),
  };
}

function restSuggestionToDTO(row: RestSuggestion): SuggestionDTO {
  return toSuggestionDTO({
    id: row.id,
    proposedSlug: row.proposed_slug,
    proposedDomain: row.proposed_domain,
    proposedLayer: row.proposed_layer,
    proposedRule: row.proposed_rule,
    proposedPattern: row.proposed_pattern,
    proposedAction: row.proposed_action,
    proposedSeverity: row.proposed_severity,
    sourceHint: row.source_hint,
    status: row.status,
    matchCount: row.match_count,
    examples: row.examples,
    createdAt: row.created_at,
  });
}

function restPolicyToDTO(row: RestPolicy): CurrentRuleDTO {
  return {
    slug: row.slug,
    domain: row.domain,
    layer: row.layer,
    rule: row.rule,
    pattern: row.pattern,
    action: row.default_action,
    severity: row.severity,
    isActive: row.is_active,
  };
}

function sortSuggestions(rows: SuggestionDTO[]): SuggestionDTO[] {
  return [
    ...rows.filter((r) => r.sourceHint === "google_workspace"),
    ...rows.filter((r) => r.sourceHint !== "google_workspace"),
  ];
}

async function listSuggestionsWithRest(orgId: string): Promise<SuggestionDTO[]> {
  const rows = await supabaseRestFetch<RestSuggestion[]>(
    `/rule_suggestions?select=id,proposed_slug,proposed_domain,proposed_layer,proposed_rule,proposed_pattern,proposed_action,proposed_severity,source_hint,status,match_count,examples,created_at&org_id=eq.${restEq(orgId)}&order=created_at.desc`,
  );
  return rows.map(restSuggestionToDTO);
}

export async function listSuggestions(orgId: string): Promise<SuggestionDTO[]> {
  try {
    const rows = await prisma.ruleSuggestion.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        proposedSlug: true,
        proposedDomain: true,
        proposedLayer: true,
        proposedRule: true,
        proposedPattern: true,
        proposedAction: true,
        proposedSeverity: true,
        sourceHint: true,
        status: true,
        matchCount: true,
        examples: true,
        createdAt: true,
      },
    });
    return rows.map(toSuggestionDTO);
  } catch (err) {
    if (!hasSupabaseRestConfig()) throw err;
    console.warn("[suggestions] Prisma list failed, falling back to Supabase REST:", err);
    return listSuggestionsWithRest(orgId);
  }
}

async function listCurrentRulesBySlugsWithRest(
  orgId: string,
  slugs: string[],
): Promise<Record<string, CurrentRuleDTO>> {
  if (slugs.length === 0) return {};
  const encoded = slugs.map((slug) => `"${slug.replaceAll('"', '\\"')}"`).join(",");
  const rows = await supabaseRestFetch<RestPolicy[]>(
    `/policies?select=id,slug,domain,layer,rule,pattern,default_action,severity,is_active&org_id=eq.${restEq(orgId)}&slug=in.(${encodeURIComponent(encoded)})`,
  );
  return Object.fromEntries(rows.map((row) => [row.slug, restPolicyToDTO(row)]));
}

export async function listCurrentRulesBySlugs(
  orgId: string,
  slugs: string[],
): Promise<Record<string, CurrentRuleDTO>> {
  if (slugs.length === 0) return {};
  try {
    const rows = await prisma.policy.findMany({
      where: { orgId, slug: { in: slugs } },
      select: {
        slug: true,
        domain: true,
        layer: true,
        rule: true,
        pattern: true,
        defaultAction: true,
        severity: true,
        isActive: true,
      },
    });
    return Object.fromEntries(
      rows.map((p) => [
        p.slug,
        {
          slug: p.slug,
          domain: p.domain,
          layer: p.layer,
          rule: p.rule,
          pattern: p.pattern,
          action: p.defaultAction,
          severity: p.severity,
          isActive: p.isActive,
        },
      ]),
    );
  } catch (err) {
    if (!hasSupabaseRestConfig()) throw err;
    console.warn("[suggestions] Prisma current-rules failed, falling back to Supabase REST:", err);
    return listCurrentRulesBySlugsWithRest(orgId, slugs);
  }
}

async function getSuggestionWithRest(orgId: string, id: string): Promise<RestSuggestion | null> {
  const rows = await supabaseRestFetch<RestSuggestion[]>(
    `/rule_suggestions?select=id,proposed_slug,proposed_domain,proposed_layer,proposed_rule,proposed_pattern,proposed_match_config,proposed_action,proposed_severity,source_hint,status,match_count,examples,created_at&id=eq.${restEq(id)}&org_id=eq.${restEq(orgId)}&limit=1`,
  );
  return rows[0] ?? null;
}

async function rejectSuggestionWithRest(input: {
  orgId: string;
  id: string;
  rejectReason?: string | null;
}) {
  await supabaseRestFetch(
    `/rule_suggestions?id=eq.${restEq(input.id)}&org_id=eq.${restEq(input.orgId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "rejected",
        reject_reason: input.rejectReason ?? null,
        decided_at: new Date().toISOString(),
      }),
    },
  );
}

async function acceptSuggestionWithRest(orgId: string, suggestion: RestSuggestion) {
  const source = suggestion.source_hint === "google_workspace" ? "google-workspace" : "ai-suggestor";
  const existing = await supabaseRestFetch<RestPolicy[]>(
    `/policies?select=id&org_id=eq.${restEq(orgId)}&slug=eq.${restEq(suggestion.proposed_slug)}&limit=1`,
  );

  let policyId = existing[0]?.id;
  const body = {
    org_id: orgId,
    slug: suggestion.proposed_slug,
    domain: suggestion.proposed_domain,
    layer: suggestion.proposed_layer,
    rule: suggestion.proposed_rule,
    pattern: suggestion.proposed_pattern,
    match_config: suggestion.proposed_match_config ?? null,
    default_action: suggestion.proposed_action,
    severity: suggestion.proposed_severity,
    source,
    is_active: true,
  };

  if (policyId) {
    await supabaseRestFetch(`/policies?id=eq.${restEq(policyId)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  } else {
    const created = await supabaseRestFetch<RestPolicy[]>("/policies", {
      method: "POST",
      body: JSON.stringify(body),
    });
    policyId = created[0]?.id;
  }

  await supabaseRestFetch(
    `/rule_suggestions?id=eq.${restEq(suggestion.id)}&org_id=eq.${restEq(orgId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "accepted",
        accepted_policy_id: policyId ?? null,
        decided_at: new Date().toISOString(),
      }),
    },
  );

  return policyId;
}

export async function decideSuggestion(input: {
  orgId: string;
  id: string;
  action: "accept" | "reject";
  rejectReason?: string | null;
}): Promise<{ policyId?: string | null }> {
  try {
    const suggestion = await prisma.ruleSuggestion.findFirst({
      where: { id: input.id, orgId: input.orgId },
    });
    if (!suggestion) throw new Error("not found");
    if (suggestion.status !== "pending") throw new Error("ya fue procesada");

    if (input.action === "reject") {
      await prisma.ruleSuggestion.update({
        where: { id: input.id },
        data: {
          status: "rejected",
          rejectReason: input.rejectReason ?? null,
          decidedAt: new Date(),
        },
      });
      return {};
    }

    const policy = await prisma.$transaction(async (tx) => {
      const upserted = await tx.policy.upsert({
        where: {
          orgId_slug: {
            orgId: input.orgId,
            slug: suggestion.proposedSlug,
          },
        },
        create: {
          orgId: input.orgId,
          slug: suggestion.proposedSlug,
          domain: suggestion.proposedDomain,
          layer: suggestion.proposedLayer,
          rule: suggestion.proposedRule,
          pattern: suggestion.proposedPattern,
          matchConfig: suggestion.proposedMatchConfig ?? undefined,
          defaultAction: suggestion.proposedAction,
          severity: suggestion.proposedSeverity,
          source:
            suggestion.sourceHint === "google_workspace" ? "google_workspace" : "ai_suggestor",
          isActive: true,
        },
        update: {
          domain: suggestion.proposedDomain,
          layer: suggestion.proposedLayer,
          rule: suggestion.proposedRule,
          pattern: suggestion.proposedPattern,
          matchConfig: suggestion.proposedMatchConfig ?? undefined,
          defaultAction: suggestion.proposedAction,
          severity: suggestion.proposedSeverity,
          source:
            suggestion.sourceHint === "google_workspace" ? "google_workspace" : "ai_suggestor",
          isActive: true,
        },
      });
      await tx.ruleSuggestion.update({
        where: { id: input.id },
        data: { status: "accepted", acceptedPolicyId: upserted.id, decidedAt: new Date() },
      });
      return upserted;
    });

    return { policyId: policy.id };
  } catch (err) {
    if (!hasSupabaseRestConfig()) throw err;
    console.warn("[suggestions] Prisma decide failed, falling back to Supabase REST:", err);
    const suggestion = await getSuggestionWithRest(input.orgId, input.id);
    if (!suggestion) throw new Error("not found");
    if (suggestion.status !== "pending") throw new Error("ya fue procesada");
    if (input.action === "reject") {
      await rejectSuggestionWithRest(input);
      return {};
    }
    const policyId = await acceptSuggestionWithRest(input.orgId, suggestion);
    return { policyId };
  }
}

export function sortSuggestionsForReview(rows: SuggestionDTO[]): SuggestionDTO[] {
  return sortSuggestions(rows);
}
