import type { NextRequest } from "next/server";

import { ENTITY_TYPE } from "@/lib/arkiv/constants";
import { searchEvidence, type EvidenceQueryFilters } from "@/lib/arkiv/queries";

const ALLOWED_ENTITY_TYPES = new Set<string>(["all", ...Object.values(ENTITY_TYPE)]);
const ALLOWED_ACTIONS = new Set(["PASS", "BLOCK", "REDACT", "WARN", "LOG"]);
const ALLOWED_SEVERITIES = new Set(["low", "medium", "high", "critical"]);

function readNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readString(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const requestedEntityType = url.searchParams.get("entityType");
  const requestedAction = url.searchParams.get("action");
  const requestedSeverity = url.searchParams.get("severity");

  const filters: EvidenceQueryFilters = {
    entityType:
      requestedEntityType && ALLOWED_ENTITY_TYPES.has(requestedEntityType)
        ? (requestedEntityType as EvidenceQueryFilters["entityType"])
        : ENTITY_TYPE.policyDecision,
    action:
      requestedAction && ALLOWED_ACTIONS.has(requestedAction.toUpperCase())
        ? requestedAction.toUpperCase()
        : undefined,
    severity:
      requestedSeverity && ALLOWED_SEVERITIES.has(requestedSeverity.toLowerCase())
        ? requestedSeverity.toLowerCase()
        : undefined,
    agentKey: readString(url.searchParams.get("agentKey")),
    minRiskScore: readNumber(url.searchParams.get("minRiskScore")),
    createdAfter: readNumber(url.searchParams.get("createdAfter")),
    createdBefore: readNumber(url.searchParams.get("createdBefore")),
    limit: readNumber(url.searchParams.get("limit")),
    cursor: readString(url.searchParams.get("cursor")),
  };

  try {
    const result = await searchEvidence(filters);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "arkiv evidence query failed",
        detail: error instanceof Error ? error.message : "unknown error",
      },
      { status: 500 },
    );
  }
}
