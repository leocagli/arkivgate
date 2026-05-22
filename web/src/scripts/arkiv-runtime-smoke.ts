import { writeFile } from "node:fs/promises";

type RuntimeHit = {
  status: number;
  traceId: string | null;
  action: string | null;
};

type InteractionRow = {
  trace_id: string;
  action: string;
  created_at: string;
  latency_by_layer?: {
    arkiv?: {
      promptReviewKey?: string;
      policyDecisionKey?: string;
      promptReviewTxHash?: string;
      policyDecisionTxHash?: string;
    };
    arkivError?: string;
    bridgePersistMs?: number;
    arkivPersistMs?: number;
  };
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env ${name}`);
  }
  return value;
}

async function hitRuntime(interceptorBase: string, token: string, prompt: string): Promise<RuntimeHit> {
  const body = {
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 120,
    messages: [{ role: "user", content: prompt }],
  };

  const response = await fetch(`${interceptorBase}/cli/${token}/v1/messages`, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": "runtime-smoke",
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    traceId: response.headers.get("x-team22-trace-id"),
    action: response.headers.get("x-team22-action"),
  };
}

async function queryInteractions(
  projectId: string,
  secret: string,
  traceIds: string[],
): Promise<InteractionRow[]> {
  const filter = traceIds.map((traceId) => `"${traceId}"`).join(",");
  const url = `https://${projectId}.supabase.co/rest/v1/interactions?select=trace_id,action,created_at,latency_by_layer&trace_id=in.(${filter})&order=created_at.desc`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      "User-Agent": "runtime-smoke",
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase query failed ${response.status}: ${text}`);
  }

  return text ? (JSON.parse(text) as InteractionRow[]) : [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasFinalArkivState(row: InteractionRow): boolean {
  return Boolean(row.latency_by_layer?.arkiv?.promptReviewTxHash || row.latency_by_layer?.arkivError);
}

function hasAllRows(traceIds: string[], rows: InteractionRow[]): boolean {
  return traceIds.every((traceId) => rows.some((row) => row.trace_id === traceId));
}

function summarize(rows: InteractionRow[]) {
  return rows.map((row) => ({
    traceId: row.trace_id,
    action: row.action,
    createdAt: row.created_at,
    hasArkivRefs: Boolean(row.latency_by_layer?.arkiv?.promptReviewTxHash),
    hasArkivError: Boolean(row.latency_by_layer?.arkivError),
    bridgePersistMs: row.latency_by_layer?.bridgePersistMs ?? null,
    arkivPersistMs: row.latency_by_layer?.arkivPersistMs ?? null,
    promptReviewTxHash: row.latency_by_layer?.arkiv?.promptReviewTxHash ?? null,
    policyDecisionTxHash: row.latency_by_layer?.arkiv?.policyDecisionTxHash ?? null,
    arkivError: row.latency_by_layer?.arkivError ?? null,
  }));
}

async function main() {
  const interceptorBase = process.env.INTERCEPTOR_BASE?.trim() || "https://arkivgate-production.up.railway.app";
  const cliToken = requiredEnv("CLI_TOKEN");
  const projectId = requiredEnv("SUPABASE_PROJECT_ID");
  const secret = requiredEnv("SUPABASE_SECRET_KEY");
  const timeoutMs = Number(process.env.ARKIV_TIMEOUT_MS ?? "45000");
  const pollMs = Number(process.env.ARKIV_POLL_MS ?? "3000");
  const outputFile = process.env.ARKIV_OUTPUT_FILE?.trim();

  const blockHit = await hitRuntime(interceptorBase, cliToken, "Mi AWS Access Key es AKIAIOSFODNN7EXAMPLE");
  const logHit = await hitRuntime(
    interceptorBase,
    cliToken,
    "Explicame en 5 lineas el patron observer en TypeScript",
  );

  const traceIds = [blockHit.traceId, logHit.traceId].filter((value): value is string => Boolean(value));
  if (traceIds.length === 0) {
    throw new Error("Runtime did not return trace IDs");
  }

  const deadline = Date.now() + timeoutMs;
  let rows: InteractionRow[] = [];

  while (Date.now() < deadline) {
    rows = await queryInteractions(projectId, secret, traceIds);
    if (hasAllRows(traceIds, rows) && rows.every((row) => hasFinalArkivState(row))) {
      break;
    }
    await sleep(pollMs);
  }

  const result = {
    interceptorBase,
    timeoutMs,
    pollMs,
    requests: [blockHit, logHit],
    summary: summarize(rows),
  };

  const output = JSON.stringify(result, null, 2);
  console.log(output);
  if (outputFile) {
    await writeFile(outputFile, `${output}\n`, "utf8");
  }

  let exitCode = 0;

  const missingRows = traceIds.some((traceId) => !rows.find((row) => row.trace_id === traceId));
  if (missingRows) {
    exitCode = 2;
  }

  const unresolvedArkiv = rows.some((row) => !hasFinalArkivState(row));
  if (unresolvedArkiv) {
    exitCode = 3;
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
