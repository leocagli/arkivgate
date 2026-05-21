import { jsonToPayload } from "@arkiv-network/sdk/utils";

import {
  ACTION,
  ENTITY_TYPE,
  EXPIRATION,
  PROJECT_ATTRIBUTE,
  type ActionType,
  type SeverityType,
} from "./constants";

type BaseEntityInput = {
  orgKey: string;
  createdAt?: number;
};

export function buildPolicyEntity(input: {
  orgKey: string;
  name: string;
  pattern: string;
  action: ActionType;
  severity: SeverityType;
  status?: "active" | "inactive";
}) {
  return {
    payload: jsonToPayload({
      name: input.name,
      pattern: input.pattern,
      action: input.action,
    }),
    contentType: "application/json",
    attributes: [
      PROJECT_ATTRIBUTE,
      { key: "entityType", value: ENTITY_TYPE.policy },
      { key: "orgKey", value: input.orgKey },
      { key: "action", value: input.action },
      { key: "severity", value: input.severity },
      { key: "status", value: input.status ?? "active" },
      { key: "createdAt", value: Date.now() },
    ],
    expiresIn: EXPIRATION.policy,
  };
}

export function buildPromptReviewEntity(
  input: BaseEntityInput & {
    sessionKey: string;
    agentKey: string;
    model: string;
    promptHash: string;
    promptRedacted: string;
    matchedRules: string[];
    action: ActionType;
    severity: SeverityType;
    riskScore: number;
    latencyMs: number;
  },
) {
  const createdAt = input.createdAt ?? Date.now();

  return {
    payload: jsonToPayload({
      promptHash: input.promptHash,
      promptRedacted: input.promptRedacted,
      model: input.model,
      matchedRules: input.matchedRules,
      latencyMs: input.latencyMs,
    }),
    contentType: "application/json",
    attributes: [
      PROJECT_ATTRIBUTE,
      { key: "entityType", value: ENTITY_TYPE.promptReview },
      { key: "orgKey", value: input.orgKey },
      { key: "sessionKey", value: input.sessionKey },
      { key: "agentKey", value: input.agentKey },
      { key: "action", value: input.action },
      { key: "severity", value: input.severity },
      { key: "riskScore", value: input.riskScore },
      { key: "createdAt", value: createdAt },
    ],
    expiresIn: EXPIRATION.promptReview,
  };
}

export function buildPolicyDecisionEntity(
  input: BaseEntityInput & {
    promptReviewKey: string;
    policyKey: string;
    finalAction: ActionType;
    severity: SeverityType;
    reason: string;
    policyLayer?: "regex" | "pattern" | "judge";
  },
) {
  const createdAt = input.createdAt ?? Date.now();

  return {
    payload: jsonToPayload({
      reason: input.reason,
      finalAction: input.finalAction,
      policyLayer: input.policyLayer ?? "regex",
      explanation:
        input.finalAction === ACTION.block
          ? "Blocked due to high leakage risk"
          : "Action persisted with policy context",
    }),
    contentType: "application/json",
    attributes: [
      PROJECT_ATTRIBUTE,
      { key: "entityType", value: ENTITY_TYPE.policyDecision },
      { key: "orgKey", value: input.orgKey },
      { key: "promptReviewKey", value: input.promptReviewKey },
      { key: "policyKey", value: input.policyKey },
      { key: "action", value: input.finalAction },
      { key: "severity", value: input.severity },
      { key: "createdAt", value: createdAt },
    ],
    expiresIn: EXPIRATION.policyDecision,
  };
}

export function buildRuleSuggestionEntity(
  input: BaseEntityInput & {
    title: string;
    suggestedRule: string;
    rationale: string;
    confidence: number;
    status?: "pending" | "approved" | "rejected";
    severity: SeverityType;
  },
) {
  const createdAt = input.createdAt ?? Date.now();

  return {
    payload: jsonToPayload({
      title: input.title,
      suggestedRule: input.suggestedRule,
      rationale: input.rationale,
      confidence: input.confidence / 100,
    }),
    contentType: "application/json",
    attributes: [
      PROJECT_ATTRIBUTE,
      { key: "entityType", value: ENTITY_TYPE.ruleSuggestion },
      { key: "orgKey", value: input.orgKey },
      { key: "status", value: input.status ?? "pending" },
      { key: "confidence", value: input.confidence },
      { key: "severity", value: input.severity },
      { key: "createdAt", value: createdAt },
    ],
    expiresIn: EXPIRATION.ruleSuggestion,
  };
}
