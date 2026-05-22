import { persistArkivPromptAudit } from "@/lib/arkiv/playground-audit";

type InterceptorBridgeBody = {
  orgId: string;
  traceId: string;
  action: "BLOCK" | "REDACT" | "WARN" | "LOG";
  severity: "low" | "medium" | "high" | "critical";
  reason: string;
  promptRedacted: string;
  model: string;
  matchedRules: string[];
  riskScore: number;
  policyKeyHint?: string;
  sessionKey?: string;
  agentKey?: string;
  latencyMs?: number;
  createdAt?: number;
};

function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const bridgeToken = process.env.ARKIV_BRIDGE_TOKEN;
  const headerToken = request.headers.get("x-arkiv-bridge-token");

  if (!bridgeToken || headerToken !== bridgeToken) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as InterceptorBridgeBody | null;
  if (!body) {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

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
    sessionKey: body.sessionKey,
    agentKey: body.agentKey,
    latencyMs: body.latencyMs,
    createdAt: body.createdAt,
  });

  return Response.json({
    ok: true,
    traceId: body.traceId,
    arkiv: {
      policyKey: persisted.policyKey,
      promptReviewKey: persisted.promptReviewKey,
      policyDecisionKey: persisted.policyDecisionKey,
    },
  });
}
