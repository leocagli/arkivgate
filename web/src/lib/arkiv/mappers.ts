import { createHash } from "node:crypto";

import { ACTION, SEVERITY, type ActionType, type SeverityType } from "./constants";

const DETECTION_RULES = [
  {
    id: "aws-access-key",
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    risk: 55,
  },
  {
    id: "private-key-block",
    pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    risk: 70,
  },
  {
    id: "generic-secret",
    pattern: /\b(secret|token|api[_-]?key|password)\s*[:=]\s*['\"]?[A-Za-z0-9_\-]{10,}/gi,
    risk: 35,
  },
] as const;

export type RiskEvaluation = {
  action: ActionType;
  severity: SeverityType;
  riskScore: number;
  matchedRules: string[];
  reason: string;
};

export function promptHash(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex");
}

export function redactPrompt(prompt: string): string {
  let value = prompt;
  for (const rule of DETECTION_RULES) {
    value = value.replace(rule.pattern, "[REDACTED_SECRET]");
  }
  return value;
}

export function evaluatePromptRisk(prompt: string): RiskEvaluation {
  const matched = DETECTION_RULES.filter((rule) => rule.pattern.test(prompt));
  const riskScore = Math.min(100, matched.reduce((acc, rule) => acc + rule.risk, 0));

  if (riskScore >= 80) {
    return {
      action: ACTION.block,
      severity: SEVERITY.critical,
      riskScore,
      matchedRules: matched.map((rule) => rule.id),
      reason: "Credential leakage pattern detected",
    };
  }

  if (riskScore >= 50) {
    return {
      action: ACTION.redact,
      severity: SEVERITY.high,
      riskScore,
      matchedRules: matched.map((rule) => rule.id),
      reason: "Sensitive content detected; redaction required",
    };
  }

  if (riskScore >= 25) {
    return {
      action: ACTION.warn,
      severity: SEVERITY.medium,
      riskScore,
      matchedRules: matched.map((rule) => rule.id),
      reason: "Potentially sensitive content in prompt",
    };
  }

  return {
    action: ACTION.log,
    severity: SEVERITY.low,
    riskScore,
    matchedRules: [],
    reason: "No sensitive patterns detected",
  };
}
