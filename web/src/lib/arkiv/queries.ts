import { eq, gte, lte } from "@arkiv-network/sdk/query";

import { getArkivPublicClient } from "./client";
import { ENTITY_TYPE, EXPIRATION, PROJECT_ATTRIBUTE } from "./constants";

const DATA_EXPLORER_URL = "https://data.arkiv.network";

export type EvidenceEntityType = (typeof ENTITY_TYPE)[keyof typeof ENTITY_TYPE];

export type EvidenceQueryFilters = {
  entityType?: EvidenceEntityType | "all";
  action?: string;
  severity?: string;
  agentKey?: string;
  owner?: string;
  creator?: string;
  minRiskScore?: number;
  createdAfter?: number;
  createdBefore?: number;
  limit?: number;
  cursor?: string;
};

type HexAddress = `0x${string}`;

export type EvidenceEntity = {
  key: string;
  owner: string | null;
  creator: string | null;
  contentType: string | null;
  expiresAtBlock: string | null;
  createdAtBlock: string | null;
  attributes: Array<{ key: string; value: string | number }>;
  payload: unknown;
  explorer: string;
  links: {
    agentEntityKey?: string;
    paymentReviewKey?: string;
    promptReviewKey?: string;
    policyKey?: string;
    threatReportKey?: string;
    threatConfirmationKey?: string;
  };
};

const ENTITY_RETENTION_DAYS: Partial<Record<EvidenceEntityType, number>> = {
  [ENTITY_TYPE.agent]: Math.round(EXPIRATION.agent / 86_400),
  [ENTITY_TYPE.agentProfile]: Math.round(EXPIRATION.agentProfile / 86_400),
  [ENTITY_TYPE.paymentReview]: Math.round(EXPIRATION.paymentReview / 86_400),
  [ENTITY_TYPE.threatReport]: Math.round(EXPIRATION.threatReport / 86_400),
  [ENTITY_TYPE.threatConfirmation]: Math.round(EXPIRATION.threatConfirmation / 86_400),
  [ENTITY_TYPE.promptReview]: Math.round(EXPIRATION.promptReview / 86_400),
  [ENTITY_TYPE.policyDecision]: Math.round(EXPIRATION.policyDecision / 86_400),
  [ENTITY_TYPE.ruleSuggestion]: Math.round(EXPIRATION.ruleSuggestion / 86_400),
  [ENTITY_TYPE.policy]: Math.round(EXPIRATION.policy / 86_400),
  [ENTITY_TYPE.auditEvent]: Math.round(EXPIRATION.auditEvent / 86_400),
  [ENTITY_TYPE.agentSession]: Math.round(EXPIRATION.agentSession / 86_400),
};

export function isHexIdentifier(value: string): boolean {
  return /^0x[0-9a-fA-F]+$/.test(value);
}

export function entityExplorerUrl(entityKey: string): string {
  return `${DATA_EXPLORER_URL}/entity/${entityKey}`;
}

export function maybeEntityExplorerUrl(entityKey?: string | null): string | undefined {
  if (!entityKey || !isHexIdentifier(entityKey)) return undefined;
  return entityExplorerUrl(entityKey);
}

export function transactionExplorerUrl(txHash: string): string {
  return `${DATA_EXPLORER_URL}/?query=${encodeURIComponent(txHash)}`;
}

export function ownerExplorerUrl(owner: string): string {
  return `${DATA_EXPLORER_URL}/owner/${owner}`;
}

export function queryUrlFor(entityType: string): string {
  const q = `${PROJECT_ATTRIBUTE.key} = \"${PROJECT_ATTRIBUTE.value}\" && entityType = \"${entityType}\"`;
  return `${DATA_EXPLORER_URL}/?query=${encodeURIComponent(q)}`;
}

export function evidenceQueryUrlFor(filters: EvidenceQueryFilters): string {
  const parts = [`${PROJECT_ATTRIBUTE.key} = "${PROJECT_ATTRIBUTE.value}"`];
  if (filters.entityType && filters.entityType !== "all") {
    parts.push(`entityType = "${filters.entityType}"`);
  }
  if (filters.action) parts.push(`action = "${filters.action}"`);
  if (filters.severity) parts.push(`severity = "${filters.severity}"`);
  if (filters.agentKey) parts.push(`agentKey = "${filters.agentKey}"`);
  if (filters.owner) parts.push(`$owner = "${filters.owner}"`);
  if (filters.creator) parts.push(`$creator = "${filters.creator}"`);
  if (typeof filters.minRiskScore === "number") parts.push(`riskScore >= ${filters.minRiskScore}`);
  if (typeof filters.createdAfter === "number") parts.push(`createdAt >= ${filters.createdAfter}`);
  if (typeof filters.createdBefore === "number") parts.push(`createdAt <= ${filters.createdBefore}`);
  return `${DATA_EXPLORER_URL}/?query=${encodeURIComponent(parts.join(" && "))}`;
}

export async function fetchByEntityType(entityType: string, limit = 20) {
  const client = getArkivPublicClient();
  return client
    .buildQuery()
    .where(eq(PROJECT_ATTRIBUTE.key, PROJECT_ATTRIBUTE.value))
    .where(eq("entityType", entityType))
    .withPayload(true)
    .withMetadata(true)
    .limit(limit)
    .fetch();
}

function attrValue(
  attributes: Array<{ key: string; value: string | number }>,
  key: string,
): string | number | undefined {
  return attributes.find((attribute) => attribute.key === key)?.value;
}

function asJsonPayload(entity: { toJson: () => unknown; toText: () => string }) {
  try {
    return entity.toJson();
  } catch {
    try {
      return entity.toText();
    } catch {
      return null;
    }
  }
}

function stringLink(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function extractLinks(
  attributes: Array<{ key: string; value: string | number }>,
  payload: unknown,
): EvidenceEntity["links"] {
  const payloadObject = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const payloadRecord = payloadObject as Record<string, unknown>;

  return {
    agentEntityKey:
      stringLink(payloadRecord.agentEntityKey) ??
      stringLink(attrValue(attributes, "agentEntityKey")),
    paymentReviewKey:
      stringLink(payloadRecord.paymentReviewKey) ??
      stringLink(attrValue(attributes, "paymentReviewKey")),
    promptReviewKey:
      stringLink(payloadRecord.promptReviewKey) ??
      stringLink(attrValue(attributes, "promptReviewKey")),
    policyKey:
      stringLink(payloadRecord.policyKey) ??
      stringLink(attrValue(attributes, "policyKey")),
    threatReportKey:
      stringLink(payloadRecord.threatReportKey) ??
      stringLink(attrValue(attributes, "threatReportKey")),
    threatConfirmationKey:
      stringLink(payloadRecord.threatConfirmationKey) ??
      stringLink(attrValue(attributes, "threatConfirmationKey")),
  };
}

function entityRetentionDays(entityType: string | number | undefined): number | null {
  if (typeof entityType !== "string") return null;
  return ENTITY_RETENTION_DAYS[entityType as EvidenceEntityType] ?? null;
}

function asHexAddress(value: string | undefined): HexAddress | null {
  return value && isHexIdentifier(value) ? (value as HexAddress) : null;
}

export async function searchEvidence(filters: EvidenceQueryFilters) {
  const client = getArkivPublicClient();
  const limit = Math.min(Math.max(filters.limit ?? 12, 1), 50);
  const entityType = filters.entityType ?? ENTITY_TYPE.policyDecision;

  let query = client
    .buildQuery()
    .where(eq(PROJECT_ATTRIBUTE.key, PROJECT_ATTRIBUTE.value))
    .withPayload(true)
    .withAttributes(true)
    .withMetadata(true)
    .orderBy("createdAt", "number", "desc")
    .limit(limit);

  if (entityType !== "all") query = query.where(eq("entityType", entityType));
  if (filters.action) query = query.where(eq("action", filters.action));
  if (filters.severity) query = query.where(eq("severity", filters.severity));
  if (filters.agentKey) query = query.where(eq("agentKey", filters.agentKey));
  const owner = asHexAddress(filters.owner);
  const creator = asHexAddress(filters.creator);
  if (owner) query = query.ownedBy(owner);
  if (creator) query = query.createdBy(creator);
  if (typeof filters.minRiskScore === "number") {
    query = query.where(gte("riskScore", filters.minRiskScore));
  }
  if (typeof filters.createdAfter === "number") {
    query = query.where(gte("createdAt", filters.createdAfter));
  }
  if (typeof filters.createdBefore === "number") {
    query = query.where(lte("createdAt", filters.createdBefore));
  }
  if (filters.cursor) query = query.cursor(filters.cursor);

  const result = await query.fetch();
  const entities: EvidenceEntity[] = result.entities.map((entity) => {
    const payload = asJsonPayload(entity);
    const key = entity.key;
    const attributes = entity.attributes ?? [];

    return {
      key,
      owner: entity.owner ?? null,
      creator: entity.creator ?? null,
      contentType: entity.contentType ?? null,
      expiresAtBlock: entity.expiresAtBlock?.toString() ?? null,
      createdAtBlock: entity.createdAtBlock?.toString() ?? null,
      attributes,
      payload,
      explorer: entityExplorerUrl(key),
      links: extractLinks(attributes, payload),
    };
  });

  return {
    project: PROJECT_ATTRIBUTE.value,
    filters: { ...filters, entityType, limit },
    count: entities.length,
    hasNextPage: result.hasNextPage(),
    cursor: result.cursor ?? null,
    explorerQuery: evidenceQueryUrlFor({ ...filters, entityType, limit }),
    retention: entities.reduce<Record<string, number>>((acc, entity) => {
      const retentionDays = entityRetentionDays(attrValue(entity.attributes, "entityType"));
      const currentEntityType = attrValue(entity.attributes, "entityType");
      if (typeof currentEntityType === "string" && retentionDays !== null) {
        acc[currentEntityType] = retentionDays;
      }
      return acc;
    }, {}),
    entities,
  };
}
