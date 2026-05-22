import { ACTION, ENTITY_TYPE, type ActionType, type SeverityType } from "./constants";
import { getArkivWalletClient } from "./client";
import {
  buildPolicyDecisionEntity,
  buildPolicyEntity,
  buildPromptReviewEntity,
} from "./entities";
import { evaluatePromptRisk, promptHash, redactPrompt } from "./mappers";
import { entityExplorerUrl, fetchByEntityType } from "./queries";

export type PersistArkivAuditInput = {
  orgKey: string;
  traceId: string;
  model: string;
  prompt?: string;
  promptRedacted?: string;
  promptHash?: string;
  action?: ActionType | "PASS";
  severity?: SeverityType;
  reason?: string;
  matchedRules?: string[];
  riskScore?: number;
  policyKeyHint?: string;
  sessionKey?: string;
  agentKey?: string;
  latencyMs?: number;
  createdAt?: number;
};

export type PersistArkivAuditResult = {
  policyKey: string;
  promptReviewKey: string;
  policyDecisionKey: string;
  explorers: {
    policy: string;
    promptReview: string;
    policyDecision: string;
  };
};

async function resolvePolicyKey(orgKey: string, policyKeyHint?: string) {
  if (policyKeyHint?.trim()) return policyKeyHint.trim();

  const latestPolicies = await fetchByEntityType(ENTITY_TYPE.policy, 1);
  const latestPolicy = latestPolicies.entities[0] as
    | { key?: string | null; entityKey?: string | null }
    | undefined;

  const existingKey = latestPolicy?.key ?? latestPolicy?.entityKey ?? null;
  if (existingKey) return existingKey;

  const walletClient = getArkivWalletClient();
  const createdPolicy = await walletClient.createEntity(
    buildPolicyEntity({
      orgKey,
      name: "Playground safety policy",
      pattern: "sensitive content detection",
      action: ACTION.warn,
      severity: "medium",
    }),
  );

  return createdPolicy.entityKey;
}

function normalizeAction(action?: ActionType | "PASS") {
  if (!action || action === "PASS") return undefined;
  return action;
}

export async function persistArkivPromptAudit(input: PersistArkivAuditInput): Promise<PersistArkivAuditResult> {
  const walletClient = getArkivWalletClient();
  const evaluation =
    typeof input.prompt === "string" && input.prompt.trim().length > 0
      ? evaluatePromptRisk(input.prompt)
      : {
          action: normalizeAction(input.action) ?? ACTION.log,
          severity: input.severity ?? "low",
          riskScore: input.riskScore ?? 0,
          matchedRules: input.matchedRules ?? [],
          reason: input.reason ?? "Prompt evaluation persisted from external source",
        };

  const finalAction: ActionType = normalizeAction(input.action) ?? evaluation.action;
  const finalSeverity = input.severity ?? evaluation.severity;
  const finalReason = input.reason ?? evaluation.reason;
  const finalRiskScore = input.riskScore ?? evaluation.riskScore;
  const finalMatchedRules = input.matchedRules ?? evaluation.matchedRules;
  const finalPromptRedacted = input.promptRedacted ?? (input.prompt ? redactPrompt(input.prompt) : "");
  const finalPromptHash =
    input.promptHash ?? (input.prompt ? promptHash(input.prompt) : promptHash(finalPromptRedacted));

  const policyKey = await resolvePolicyKey(input.orgKey, input.policyKeyHint);

  const promptReview = await walletClient.createEntity(
    buildPromptReviewEntity({
      orgKey: input.orgKey,
      sessionKey: input.sessionKey ?? `session_${input.traceId}`,
      agentKey: input.agentKey ?? "agent_arkivgate_playground",
      model: input.model,
      promptHash: finalPromptHash,
      promptRedacted: finalPromptRedacted,
      matchedRules: finalMatchedRules,
      action: finalAction,
      severity: finalSeverity,
      riskScore: finalRiskScore,
      latencyMs: input.latencyMs ?? 0,
      createdAt: input.createdAt,
    }),
  );

  const policyDecision = await walletClient.createEntity(
    buildPolicyDecisionEntity({
      orgKey: input.orgKey,
      promptReviewKey: promptReview.entityKey,
      policyKey,
      finalAction,
      severity: finalSeverity,
      reason: finalReason,
      policyLayer: "regex",
      createdAt: input.createdAt,
    }),
  );

  return {
    policyKey,
    promptReviewKey: promptReview.entityKey,
    policyDecisionKey: policyDecision.entityKey,
    explorers: {
      policy: entityExplorerUrl(policyKey),
      promptReview: entityExplorerUrl(promptReview.entityKey),
      policyDecision: entityExplorerUrl(policyDecision.entityKey),
    },
  };
}