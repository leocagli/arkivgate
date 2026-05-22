import { eq } from "@arkiv-network/sdk/query";

import { getArkivPublicClient } from "./client";
import { PROJECT_ATTRIBUTE } from "./constants";

const DATA_EXPLORER_URL = "https://data.arkiv.network";

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
