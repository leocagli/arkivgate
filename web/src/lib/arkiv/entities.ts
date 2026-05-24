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

export function buildAgentEntity(input: BaseEntityInput & {
  agentKey: string;
  paymentRail?: "x402-demo" | "none";
}) {
  const createdAt = input.createdAt ?? Date.now();

  return {
    payload: jsonToPayload({
      agentKey: input.agentKey,
      paymentRail: input.paymentRail ?? "none",
    }),
    contentType: "application/json",
    attributes: [
      PROJECT_ATTRIBUTE,
      { key: "entityType", value: ENTITY_TYPE.agent },
      { key: "orgKey", value: input.orgKey },
      { key: "agentKey", value: input.agentKey },
      { key: "paymentRail", value: input.paymentRail ?? "none" },
      { key: "createdAt", value: createdAt },
    ],
    expiresIn: EXPIRATION.agent,
  };
}

export function buildAgentProfileEntity(input: BaseEntityInput & {
  walletAddress: string;
  displayName?: string;
}) {
  const createdAt = input.createdAt ?? Date.now();
  const walletAddress = input.walletAddress.toLowerCase();

  return {
    payload: jsonToPayload({
      walletAddress,
      agentKey: walletAddress,
      displayName: input.displayName ?? "Wallet-owned ArkivGate agent",
      createdVia: "browser-wallet",
    }),
    contentType: "application/json",
    attributes: [
      PROJECT_ATTRIBUTE,
      { key: "entityType", value: ENTITY_TYPE.agentProfile },
      { key: "orgKey", value: input.orgKey },
      { key: "agentKey", value: walletAddress },
      { key: "ownerAddress", value: walletAddress },
      { key: "status", value: "active" },
      { key: "createdAt", value: createdAt },
    ],
    expiresIn: EXPIRATION.agentProfile,
  };
}

export function buildPaymentReviewEntity(
  input: BaseEntityInput & {
    agentKey: string;
    agentEntityKey: string;
    paymentRail: "x402-demo" | "none";
    verdict: ActionType | "PASS";
    severity: SeverityType;
    riskScore: number;
    reason: string;
    matchedRules: string[];
    walletBalanceUsd?: number;
    transferUsd?: number;
    adjustedTransferUsd?: number;
    recentMaxTransferUsd?: number;
    perTxLimitUsd?: number;
    recipientRisk?: "low" | "unknown" | "high";
  },
) {
  const createdAt = input.createdAt ?? Date.now();

  return {
    payload: jsonToPayload({
      agentKey: input.agentKey,
      agentEntityKey: input.agentEntityKey,
      paymentRail: input.paymentRail,
      verdict: input.verdict,
      reason: input.reason,
      matchedRules: input.matchedRules,
      walletBalanceUsd: input.walletBalanceUsd,
      transferUsd: input.transferUsd,
      adjustedTransferUsd: input.adjustedTransferUsd,
      recentMaxTransferUsd: input.recentMaxTransferUsd,
      perTxLimitUsd: input.perTxLimitUsd,
      recipientRisk: input.recipientRisk,
    }),
    contentType: "application/json",
    attributes: [
      PROJECT_ATTRIBUTE,
      { key: "entityType", value: ENTITY_TYPE.paymentReview },
      { key: "orgKey", value: input.orgKey },
      { key: "agentKey", value: input.agentKey },
      { key: "agentEntityKey", value: input.agentEntityKey },
      { key: "paymentRail", value: input.paymentRail },
      { key: "action", value: input.verdict },
      { key: "severity", value: input.severity },
      { key: "riskScore", value: input.riskScore },
      { key: "createdAt", value: createdAt },
    ],
    expiresIn: EXPIRATION.paymentReview,
  };
}

export function buildPromptReviewEntity(
  input: BaseEntityInput & {
    sessionKey: string;
    agentKey: string;
    agentEntityKey?: string;
    paymentReviewKey?: string;
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
      agentEntityKey: input.agentEntityKey,
      paymentReviewKey: input.paymentReviewKey,
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
      ...(input.agentEntityKey ? [{ key: "agentEntityKey", value: input.agentEntityKey }] : []),
      ...(input.paymentReviewKey ? [{ key: "paymentReviewKey", value: input.paymentReviewKey }] : []),
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
    paymentReviewKey?: string;
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
      paymentReviewKey: input.paymentReviewKey,
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
      ...(input.paymentReviewKey ? [{ key: "paymentReviewKey", value: input.paymentReviewKey }] : []),
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
