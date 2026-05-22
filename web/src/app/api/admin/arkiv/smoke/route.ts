import type { NextRequest } from "next/server";

import { requireAdminRole } from "@/lib/admin-session";
import { getArkivWalletClient } from "@/lib/arkiv/client";
import { ACTION } from "@/lib/arkiv/constants";
import {
  buildPolicyDecisionEntity,
  buildPolicyEntity,
  buildPromptReviewEntity,
} from "@/lib/arkiv/entities";
import { evaluatePromptRisk, promptHash, redactPrompt } from "@/lib/arkiv/mappers";
import { entityExplorerUrl, queryUrlFor, transactionExplorerUrl } from "@/lib/arkiv/queries";

export async function POST(request: NextRequest) {
  const auth = await requireAdminRole();
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const payload = (await request.json().catch(() => ({}))) as {
    prompt?: string;
    model?: string;
    sessionKey?: string;
    agentKey?: string;
  };

  const prompt =
    payload.prompt ??
    "Help me deploy this quickly. Here is my key: AKIA1234567890ABCDEF";
  const model = payload.model ?? "claude-sonnet";
  const sessionKey = payload.sessionKey ?? `session_${Date.now()}`;
  const agentKey = payload.agentKey ?? "agent_claude_code";

  const walletClient = getArkivWalletClient();

  const { entityKey: policyKey, txHash: policyTxHash } = await walletClient.createEntity(
    buildPolicyEntity({
      orgKey: session.orgId,
      name: "Block AWS key leakage",
      pattern: "AKIA[0-9A-Z]{16}",
      action: ACTION.block,
      severity: "high",
    }),
  );

  const started = Date.now();
  const risk = evaluatePromptRisk(prompt);

  const { entityKey: promptReviewKey, txHash: promptReviewTxHash } = await walletClient.createEntity(
    buildPromptReviewEntity({
      orgKey: session.orgId,
      sessionKey,
      agentKey,
      model,
      promptHash: promptHash(prompt),
      promptRedacted: redactPrompt(prompt),
      matchedRules: risk.matchedRules,
      action: risk.action,
      severity: risk.severity,
      riskScore: risk.riskScore,
      latencyMs: Date.now() - started,
    }),
  );

  const { entityKey: policyDecisionKey, txHash: policyDecisionTxHash } = await walletClient.createEntity(
    buildPolicyDecisionEntity({
      orgKey: session.orgId,
      promptReviewKey,
      policyKey,
      finalAction: risk.action,
      severity: risk.severity,
      reason: risk.reason,
      policyLayer: "regex",
    }),
  );

  return Response.json({
    ok: true,
    action: risk.action,
    riskScore: risk.riskScore,
    entities: {
      policy: {
        key: policyKey,
        txHash: policyTxHash,
        explorer: entityExplorerUrl(policyKey),
        txExplorer: transactionExplorerUrl(policyTxHash),
      },
      promptReview: {
        key: promptReviewKey,
        txHash: promptReviewTxHash,
        explorer: entityExplorerUrl(promptReviewKey),
        txExplorer: transactionExplorerUrl(promptReviewTxHash),
      },
      policyDecision: {
        key: policyDecisionKey,
        txHash: policyDecisionTxHash,
        explorer: entityExplorerUrl(policyDecisionKey),
        txExplorer: transactionExplorerUrl(policyDecisionTxHash),
      },
    },
    queries: {
      promptReview: queryUrlFor("prompt_review"),
      policyDecision: queryUrlFor("policy_decision"),
      policy: queryUrlFor("policy"),
    },
  });
}
