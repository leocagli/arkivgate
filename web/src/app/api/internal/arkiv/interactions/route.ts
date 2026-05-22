import { persistArkivPromptAudit } from "@/lib/arkiv/playground-audit";

type PolicyHitRecord = {
  layer: "regex" | "pattern" | "nl";
  policy_id: string;
  slug: string;
  action: "BLOCK" | "REDACT" | "WARN" | "LOG";
};

type ArkivRefs = {
  policyKey: string;
  promptReviewKey: string;
  policyDecisionKey: string;
  policyTxHash?: string;
  promptReviewTxHash: string;
  policyDecisionTxHash: string;
  explorers: {
    policy?: string;
    promptReview: string;
    policyDecision: string;
    policyTx?: string;
    promptReviewTx: string;
    policyDecisionTx: string;
  };
};

type InterceptorBridgeBody = {
  orgId: string;
  traceId: string;
  userId?: string | null;
  action: "BLOCK" | "REDACT" | "WARN" | "LOG";
  severity: "low" | "medium" | "high" | "critical";
  reason: string;
  promptRedacted: string;
  model: string;
  policyHits?: PolicyHitRecord[];
  matchedRules: string[];
  riskScore: number;
  upstreamStatus?: number | null;
  policyKeyHint?: string;
  policySlugHint?: string;
  sessionKey?: string;
  agentKey?: string;
  latencyMs?: number;
  createdAt?: number;
};

type BridgeTimings = {
  dbPersistMs: number;
  arkivPersistMs: number;
};

function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

function supabaseConfig() {
  const projectId = process.env.SUPABASE_PROJECT_ID;
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!projectId || !secret) {
    throw new Error("Missing SUPABASE_PROJECT_ID or SUPABASE_SECRET_KEY");
  }

  return {
    baseUrl: `https://${projectId}.supabase.co/rest/v1`,
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      "User-Agent": "vercel",
    },
  };
}

async function supabaseFetch(path: string, init?: RequestInit) {
  const { baseUrl, headers } = supabaseConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase ${path} ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefined(entry)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, stripUndefined(entry)]),
    ) as T;
  }

  return value;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function clipErrorMessage(error: unknown, maxLength = 280): string {
  const value = error instanceof Error ? error.message : String(error);
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizePolicyHits(body: InterceptorBridgeBody): PolicyHitRecord[] {
  if (Array.isArray(body.policyHits) && body.policyHits.length > 0) {
    return body.policyHits;
  }

  return body.matchedRules.map((slug) => ({
    layer: "regex",
    policy_id: slug,
    slug,
    action: body.action,
  }));
}

function mergeLatencyByLayer(current: unknown, arkivRefs?: ArkivRefs) {
  const value = asObject(current);
  return {
    ...value,
    ...(arkivRefs ? { arkiv: stripUndefined(arkivRefs) } : {}),
  };
}

function withPendingArkivState(current: unknown) {
  const value = asObject(current);
  return {
    ...value,
    arkivStatus: typeof value.arkivStatus === "string" ? value.arkivStatus : "pending",
  };
}

type InteractionRow = {
  id: string;
  latency_by_layer?: Record<string, unknown> | null;
};

async function upsertInteractionRow(body: InterceptorBridgeBody, existing: InteractionRow | null) {
  const baseLatencyByLayer = withPendingArkivState(
    mergeLatencyByLayer(existing?.latency_by_layer ?? null),
  );

  if (existing) {
    const rows = await supabaseFetch(`/interactions?id=eq.${encodeURIComponent(existing.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        user_id: body.userId ?? null,
        request_model: body.model,
        prompt: body.promptRedacted,
        action: body.action,
        reason: body.reason,
        policy_hits: normalizePolicyHits(body),
        latency_total_ms: body.latencyMs ?? 0,
        latency_by_layer: baseLatencyByLayer,
        upstream_status: body.upstreamStatus ?? null,
      }),
    });

    return Array.isArray(rows) ? ((rows[0] as InteractionRow | null) ?? existing) : existing;
  }

  const rows = await supabaseFetch(`/interactions`, {
    method: "POST",
    body: JSON.stringify(
      stripUndefined({
        id: crypto.randomUUID(),
        trace_id: body.traceId,
        org_id: body.orgId,
        user_id: body.userId ?? null,
        request_model: body.model,
        prompt: body.promptRedacted,
        action: body.action,
        reason: body.reason,
        policy_hits: normalizePolicyHits(body),
        latency_total_ms: body.latencyMs ?? 0,
        latency_by_layer: baseLatencyByLayer,
        upstream_status: body.upstreamStatus ?? null,
        created_at: body.createdAt ? new Date(body.createdAt).toISOString() : undefined,
      }),
    ),
  });

  return Array.isArray(rows) ? ((rows[0] as InteractionRow | null) ?? null) : null;
}

async function patchInteractionArkiv(
  interactionId: string,
  currentLatencyByLayer: unknown,
  arkivRefs: ArkivRefs | null,
  arkivError: string | null,
  timings: BridgeTimings,
) {
  await supabaseFetch(`/interactions?id=eq.${encodeURIComponent(interactionId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      latency_by_layer: {
        ...mergeLatencyByLayer(currentLatencyByLayer, arkivRefs ?? undefined),
        arkivStatus: arkivRefs ? "ok" : arkivError ? "error" : "pending",
        bridgePersistMs: timings.dbPersistMs,
        arkivPersistMs: timings.arkivPersistMs,
        ...(arkivError ? { arkivError } : {}),
      },
    }),
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const bridgeToken = process.env.ARKIV_BRIDGE_TOKEN;
  const headerToken = request.headers.get("x-arkiv-bridge-token");

  if (!bridgeToken || headerToken !== bridgeToken) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as InterceptorBridgeBody | null;
  if (!body) {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const traceId = encodeURIComponent(body.traceId);
  const existingRows = await supabaseFetch(
    `/interactions?select=id,latency_by_layer&trace_id=eq.${traceId}&limit=1`,
  );
  const existing = Array.isArray(existingRows) ? (existingRows[0] as InteractionRow | null) : null;
  const dbStartedAt = Date.now();
  const interaction = await upsertInteractionRow(body, existing);
  const dbPersistMs = Date.now() - dbStartedAt;

  let arkivRefs: ArkivRefs | null = null;
  let arkivError: string | null = null;
  const arkivStartedAt = Date.now();
  let arkivPersistMs = 0;

  try {
    const persisted = await persistArkivPromptAudit({
      orgKey: body.orgId,
      traceId: body.traceId,
      model: body.model,
      promptRedacted: body.promptRedacted,
      action: body.action,
      severity: body.severity,
      reason: body.reason,
      matchedRules: body.matchedRules,
      riskScore: body.riskScore,
      policyKeyHint: body.policyKeyHint,
      policySlugHint: body.policySlugHint,
      sessionKey: body.sessionKey,
      agentKey: body.agentKey,
      latencyMs: body.latencyMs,
      createdAt: body.createdAt,
    });

    arkivRefs = {
      policyKey: persisted.policyKey,
      promptReviewKey: persisted.promptReviewKey,
      policyDecisionKey: persisted.policyDecisionKey,
      policyTxHash: persisted.policyTxHash,
      promptReviewTxHash: persisted.promptReviewTxHash,
      policyDecisionTxHash: persisted.policyDecisionTxHash,
      explorers: persisted.explorers,
    };
  } catch (error) {
    arkivError = clipErrorMessage(error);
  } finally {
    arkivPersistMs = Date.now() - arkivStartedAt;
  }

  if (interaction?.id) {
    await patchInteractionArkiv(
      interaction.id,
      interaction.latency_by_layer ?? existing?.latency_by_layer ?? null,
      arkivRefs,
      arkivError,
      {
        dbPersistMs,
        arkivPersistMs,
      },
    );
  }

  const totalMs = Date.now() - startedAt;
  console.info(
    "[arkiv_bridge_web] trace=%s action=%s db_ms=%d arkiv_ms=%d total_ms=%d outcome=%s",
    body.traceId,
    body.action,
    dbPersistMs,
    arkivPersistMs,
    totalMs,
    arkivRefs ? "ok" : "error",
  );

  return Response.json({
    ok: true,
    traceId: body.traceId,
    arkiv: arkivRefs,
    arkivError,
  });
}
