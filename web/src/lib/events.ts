import type { Interaction } from "@prisma/client";

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
