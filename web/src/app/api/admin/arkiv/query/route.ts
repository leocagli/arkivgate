import type { NextRequest } from "next/server";

import { getAdminSession } from "@/lib/admin-session";
import { ENTITY_TYPE } from "@/lib/arkiv/constants";
import { fetchByEntityType, queryUrlFor } from "@/lib/arkiv/queries";

type ArkivEntityType = (typeof ENTITY_TYPE)[keyof typeof ENTITY_TYPE];
const ALLOWED_ENTITY_TYPES = new Set<ArkivEntityType>(Object.values(ENTITY_TYPE));

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const requestedEntityType = url.searchParams.get("entityType");
  const entityType: ArkivEntityType =
    requestedEntityType && ALLOWED_ENTITY_TYPES.has(requestedEntityType as ArkivEntityType)
      ? (requestedEntityType as ArkivEntityType)
      : ENTITY_TYPE.promptReview;

  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;

  const result = await fetchByEntityType(entityType, limit);

  return Response.json({
    ok: true,
    entityType,
    count: result.entities.length,
    explorerQuery: queryUrlFor(entityType),
    entities: result.entities.map((entity: any) => ({
      key: entity.key ?? entity.entityKey ?? null,
      owner: entity.owner ?? null,
      attributes: entity.attributes ?? [],
      payload: entity.payload ?? null,
      metadata: entity.metadata ?? null,
    })),
  });
}
