import { promptHash } from "@/lib/arkiv/mappers";
import { getArkivWalletClient } from "@/lib/arkiv/client";
import { buildPolicyDecisionEntity, buildPromptReviewEntity } from "@/lib/arkiv/entities";

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

  const walletClient = getArkivWalletClient();

  const promptReview = await walletClient.createEntity(
    buildPromptReviewEntity({
      orgKey: body.orgId,
      sessionKey: body.sessionKey ?? `session_${body.traceId}`,
      agentKey: body.agentKey ?? "agent_arkivgate_proxy",
      model: body.model,
      promptHash: promptHash(body.promptRedacted),
      promptRedacted: body.promptRedacted,
      matchedRules: body.matchedRules,
      action: body.action,
      severity: body.severity,
      riskScore: body.riskScore,
      latencyMs: body.latencyMs ?? 0,
      createdAt: body.createdAt,
    }),
  );

  const policyDecision = await walletClient.createEntity(
    buildPolicyDecisionEntity({
      orgKey: body.orgId,
      promptReviewKey: promptReview.entityKey,
      policyKey: body.policyKeyHint ?? `policy_hint_${body.traceId}`,
      finalAction: body.action,
      severity: body.severity,
      reason: body.reason,
      policyLayer: "regex",
      createdAt: body.createdAt,
    }),
  );

  return Response.json({
    ok: true,
    traceId: body.traceId,
    arkiv: {
      promptReviewKey: promptReview.entityKey,
      policyDecisionKey: policyDecision.entityKey,
    },
  });
}
