export type PolicyVerdict = "PASS" | "WARN" | "REDACT" | "BLOCK";

export type PaymentIntent = {
  walletBalanceUsd: number;
  transferUsd: number;
  recentMaxTransferUsd: number;
  perTxLimitUsd: number;
  recipientRisk: "low" | "unknown" | "high";
};

export type PaymentPolicyResult = {
  verdict: PolicyVerdict;
  severity: "low" | "medium" | "high" | "critical";
  riskScore: number;
  reason: string;
  matchedRules: string[];
  intent: PaymentIntent;
  adjustedTransferUsd?: number;
};

export function normalizePaymentIntent(input?: Partial<PaymentIntent> | null): PaymentIntent {
  return {
    walletBalanceUsd: clampMoney(input?.walletBalanceUsd, 100),
    transferUsd: clampMoney(input?.transferUsd, 12),
    recentMaxTransferUsd: clampMoney(input?.recentMaxTransferUsd, 20),
    perTxLimitUsd: clampMoney(input?.perTxLimitUsd, 40),
    recipientRisk: input?.recipientRisk === "high" || input?.recipientRisk === "unknown" ? input.recipientRisk : "low",
  };
}

export function evaluatePaymentPolicy(input?: Partial<PaymentIntent> | null): PaymentPolicyResult {
  const intent = normalizePaymentIntent(input);
  const balance = Math.max(intent.walletBalanceUsd, 0.01);
  const perTxLimit = Math.max(intent.perTxLimitUsd, 0.01);
  const ratio = intent.transferUsd / balance;
  const matchedRules: string[] = [];

  if (intent.recipientRisk === "high") {
    matchedRules.push("high-risk-recipient");
    return {
      verdict: "BLOCK",
      severity: "critical",
      riskScore: 95,
      reason: "recipient is marked high risk",
      matchedRules,
      intent,
    };
  }

  if (intent.transferUsd >= balance) {
    matchedRules.push("full-balance-transfer");
    return {
      verdict: "BLOCK",
      severity: "critical",
      riskScore: 100,
      reason: "transfer attempts to move 100% or more of wallet balance",
      matchedRules,
      intent,
    };
  }

  if (ratio > 0.5 && intent.transferUsd > intent.recentMaxTransferUsd) {
    matchedRules.push("unusual-major-balance-transfer");
    return {
      verdict: "WARN",
      severity: "medium",
      riskScore: Math.min(89, Math.round(ratio * 100)),
      reason: "transfer is over 50% of balance and above the wallet's recent max",
      matchedRules,
      intent,
    };
  }

  if (intent.recipientRisk === "unknown" && ratio >= 0.25) {
    matchedRules.push("unknown-recipient-material-transfer");
    return {
      verdict: "WARN",
      severity: "medium",
      riskScore: Math.min(79, Math.round(ratio * 100)),
      reason: "recipient is new or unknown for a material transfer",
      matchedRules,
      intent,
    };
  }

  if (intent.transferUsd > perTxLimit) {
    matchedRules.push("per-transfer-cap");
    return {
      verdict: "REDACT",
      severity: "high",
      riskScore: Math.min(84, Math.round((intent.transferUsd / perTxLimit) * 35)),
      reason: "transfer exceeds configured per-transaction cap; amount is capped before execution",
      matchedRules,
      intent,
      adjustedTransferUsd: perTxLimit,
    };
  }

  return {
    verdict: "PASS",
    severity: "low",
    riskScore: Math.max(1, Math.round(ratio * 25)),
    reason: "payment intent is within balance, recipient and transfer-size policy",
    matchedRules,
    intent,
  };
}

export function worstVerdict(verdicts: PolicyVerdict[]): PolicyVerdict {
  if (verdicts.includes("BLOCK")) return "BLOCK";
  if (verdicts.includes("REDACT")) return "REDACT";
  if (verdicts.includes("WARN")) return "WARN";
  return "PASS";
}

function clampMoney(value: unknown, fallback: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.round(numeric * 100) / 100;
}
