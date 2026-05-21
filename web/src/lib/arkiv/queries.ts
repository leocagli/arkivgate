import { eq } from "@arkiv-network/sdk/query";

import { getArkivPublicClient } from "./client";
import { PROJECT_ATTRIBUTE } from "./constants";

const EXPLORER_URL = "https://data.arkiv.network";

export function entityExplorerUrl(entityKey: string): string {
  return `${EXPLORER_URL}/entity/${entityKey}`;
}

export function ownerExplorerUrl(owner: string): string {
  return `${EXPLORER_URL}/owner/${owner}`;
}

export function queryUrlFor(entityType: string): string {
  const q = `${PROJECT_ATTRIBUTE.key} = \"${PROJECT_ATTRIBUTE.value}\" && entityType = \"${entityType}\"`;
  return `${EXPLORER_URL}/?query=${encodeURIComponent(q)}`;
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
