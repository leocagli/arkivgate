import { ExpirationTime } from "@arkiv-network/sdk/utils";

export const PROJECT_ATTRIBUTE = {
  key: "project",
  value: process.env.ARKIV_PROJECT ?? "arkivgate-leocagli-2026",
} as const;

export const ENTITY_TYPE = {
  organization: "organization",
  agent: "agent",
  agentProfile: "agent_profile",
  paymentReview: "payment_review",
  policy: "policy",
  agentSession: "agent_session",
  promptReview: "prompt_review",
  policyDecision: "policy_decision",
  ruleSuggestion: "rule_suggestion",
  auditEvent: "audit_event",
} as const;

export const ACTION = {
  block: "BLOCK",
  redact: "REDACT",
  warn: "WARN",
  log: "LOG",
} as const;

export const SEVERITY = {
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
} as const;

export type ActionType = (typeof ACTION)[keyof typeof ACTION];
export type SeverityType = (typeof SEVERITY)[keyof typeof SEVERITY];

export const EXPIRATION = {
  agentSession: ExpirationTime.fromDays(7),
  agent: ExpirationTime.fromDays(365),
  agentProfile: ExpirationTime.fromDays(365),
  paymentReview: ExpirationTime.fromDays(180),
  promptReview: ExpirationTime.fromDays(30),
  policyDecision: ExpirationTime.fromDays(180),
  ruleSuggestion: ExpirationTime.fromDays(7),
  policy: ExpirationTime.fromDays(365),
  auditEvent: ExpirationTime.fromDays(365),
} as const;
