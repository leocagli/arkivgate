import type { Interaction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasSupabaseRestConfig, restEq, supabaseRestFetch } from "@/lib/supabase-rest";

export type PolicyHitRecord = {
  layer: "regex" | "pattern" | "nl";
  policy_id: string;
  slug: string;
  action: "BLOCK" | "REDACT" | "WARN" | "LOG";
};

export type EventDTO = {
  id: string;
  traceId: string;
  action: "BLOCK" | "REDACT" | "WARN" | "LOG";
  reason: string;
  requestModel: string;
  prompt: string;
  policyHits: PolicyHitRecord[];
  latencyTotalMs: number;
  latencyByLayer: Record<string, number>;
  bridgePersistMs: number | null;
  arkivPersistMs: number | null;
  arkivStatus: "pending" | "ok" | "error" | null;
  upstreamStatus: number | null;
  arkivError: string | null;
  arkiv: {
    policyKey?: string;
    promptReviewKey?: string;
    policyDecisionKey?: string;
    policyTxHash?: string;
    promptReviewTxHash?: string;
    policyDecisionTxHash?: string;
    explorers?: {
      policy?: string;
      promptReview?: string;
      policyDecision?: string;
      policyTx?: string;
      promptReviewTx?: string;
      policyDecisionTx?: string;
    };
  } | null;
  createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractArkiv(value: unknown): EventDTO["arkiv"] {
  if (!isRecord(value)) return null;

  const explorers = isRecord(value.explorers)
    ? {
        policy: typeof value.explorers.policy === "string" ? value.explorers.policy : undefined,
        promptReview:
          typeof value.explorers.promptReview === "string" ? value.explorers.promptReview : undefined,
        policyDecision:
          typeof value.explorers.policyDecision === "string"
            ? value.explorers.policyDecision
            : undefined,
        policyTx: typeof value.explorers.policyTx === "string" ? value.explorers.policyTx : undefined,
        promptReviewTx:
          typeof value.explorers.promptReviewTx === "string"
            ? value.explorers.promptReviewTx
            : undefined,
        policyDecisionTx:
          typeof value.explorers.policyDecisionTx === "string"
            ? value.explorers.policyDecisionTx
            : undefined,
      }
    : undefined;

  return {
    policyKey: typeof value.policyKey === "string" ? value.policyKey : undefined,
    promptReviewKey: typeof value.promptReviewKey === "string" ? value.promptReviewKey : undefined,
    policyDecisionKey:
      typeof value.policyDecisionKey === "string" ? value.policyDecisionKey : undefined,
    policyTxHash: typeof value.policyTxHash === "string" ? value.policyTxHash : undefined,
    promptReviewTxHash:
      typeof value.promptReviewTxHash === "string" ? value.promptReviewTxHash : undefined,
    policyDecisionTxHash:
      typeof value.policyDecisionTxHash === "string" ? value.policyDecisionTxHash : undefined,
    explorers,
  };
}

function extractLatencyByLayer(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, entry]) =>
        key !== "arkiv" &&
        key !== "bridgePersistMs" &&
        key !== "arkivPersistMs" &&
        key !== "arkivStatus" &&
        typeof entry === "number",
    ),
  ) as Record<string, number>;
}

export function toEventDTO(row: Interaction): EventDTO {
  const latencyByLayer = row.latencyByLayer ?? {};
  const arkiv = isRecord(latencyByLayer) ? extractArkiv(latencyByLayer.arkiv) : null;
  const bridgePersistMs =
    isRecord(latencyByLayer) && typeof latencyByLayer.bridgePersistMs === "number"
      ? latencyByLayer.bridgePersistMs
      : null;
  const arkivPersistMs =
    isRecord(latencyByLayer) && typeof latencyByLayer.arkivPersistMs === "number"
      ? latencyByLayer.arkivPersistMs
      : null;
  const arkivStatus =
    isRecord(latencyByLayer) &&
    (latencyByLayer.arkivStatus === "pending" ||
      latencyByLayer.arkivStatus === "ok" ||
      latencyByLayer.arkivStatus === "error")
      ? latencyByLayer.arkivStatus
      : null;
  const arkivError =
    isRecord(latencyByLayer) && typeof latencyByLayer.arkivError === "string"
      ? latencyByLayer.arkivError
      : null;

  return {
    id: row.id,
    traceId: row.traceId,
    action: row.action as EventDTO["action"],
    reason: row.reason,
    requestModel: row.requestModel,
    prompt: row.prompt,
    policyHits: (row.policyHits ?? []) as PolicyHitRecord[],
    latencyTotalMs: row.latencyTotalMs,
    latencyByLayer: extractLatencyByLayer(latencyByLayer),
    bridgePersistMs,
    arkivPersistMs,
    arkivStatus,
    upstreamStatus: row.upstreamStatus,
    arkivError,
    arkiv,
    createdAt: row.createdAt.toISOString(),
  };
}

type RestInteraction = {
  id: string;
  trace_id: string;
  action: EventDTO["action"];
  reason: string;
  request_model: string;
  prompt: string;
  policy_hits: PolicyHitRecord[] | null;
  latency_total_ms: number;
  latency_by_layer: unknown;
  upstream_status: number | null;
  created_at: string;
};

function restInteractionToDTO(row: RestInteraction): EventDTO {
  const latencyByLayer = row.latency_by_layer;
  const arkiv = isRecord(latencyByLayer) ? extractArkiv(latencyByLayer.arkiv) : null;
  const bridgePersistMs =
    isRecord(latencyByLayer) && typeof latencyByLayer.bridgePersistMs === "number"
      ? latencyByLayer.bridgePersistMs
      : null;
  const arkivPersistMs =
    isRecord(latencyByLayer) && typeof latencyByLayer.arkivPersistMs === "number"
      ? latencyByLayer.arkivPersistMs
      : null;
  const arkivStatus =
    isRecord(latencyByLayer) &&
    (latencyByLayer.arkivStatus === "pending" ||
      latencyByLayer.arkivStatus === "ok" ||
      latencyByLayer.arkivStatus === "error")
      ? latencyByLayer.arkivStatus
      : null;
  const arkivError =
    isRecord(latencyByLayer) && typeof latencyByLayer.arkivError === "string"
      ? latencyByLayer.arkivError
      : null;

  return {
    id: row.id,
    traceId: row.trace_id,
    action: row.action,
    reason: row.reason,
    requestModel: row.request_model,
    prompt: row.prompt,
    policyHits: row.policy_hits ?? [],
    latencyTotalMs: row.latency_total_ms,
    latencyByLayer: extractLatencyByLayer(latencyByLayer),
    bridgePersistMs,
    arkivPersistMs,
    arkivStatus,
    upstreamStatus: row.upstream_status,
    arkivError,
    arkiv,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

type ListEventsInput = {
  orgId: string;
  since?: Date | null;
  action?: EventDTO["action"] | null;
  limit?: number;
};

async function listEventsWithRest(input: ListEventsInput): Promise<EventDTO[]> {
  const params = [
    "select=id,trace_id,action,reason,request_model,prompt,policy_hits,latency_total_ms,latency_by_layer,upstream_status,created_at",
    `org_id=eq.${restEq(input.orgId)}`,
    "order=created_at.desc",
    `limit=${input.limit ?? 100}`,
  ];
  if (input.since) params.push(`created_at=gt.${encodeURIComponent(input.since.toISOString())}`);
  if (input.action) params.push(`action=eq.${input.action}`);

  const rows = await supabaseRestFetch<RestInteraction[]>(`/interactions?${params.join("&")}`);
  return rows.map(restInteractionToDTO);
}

export async function listEvents(input: ListEventsInput): Promise<EventDTO[]> {
  try {
    const rows = await prisma.interaction.findMany({
      where: {
        orgId: input.orgId,
        ...(input.since ? { createdAt: { gt: input.since } } : {}),
        ...(input.action ? { action: input.action } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: input.limit ?? 100,
    });
    return rows.map(toEventDTO);
  } catch (err) {
    if (!hasSupabaseRestConfig()) throw err;
    console.warn("[events] Prisma list failed, falling back to Supabase REST:", err);
    return listEventsWithRest(input);
  }
}
