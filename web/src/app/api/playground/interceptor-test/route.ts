import { NextResponse } from "next/server";

import { ACTION } from "@/lib/arkiv/constants";
import { evaluatePromptRisk, promptHash, redactPrompt } from "@/lib/arkiv/mappers";
import { persistArkivPromptAudit } from "@/lib/arkiv/playground-audit";
import {
  evaluatePaymentPolicy,
  normalizePaymentIntent,
  worstVerdict,
  type PaymentIntent,
  type PolicyVerdict,
} from "@/lib/payment-policy";
import { appendPaymentResponse, buildDemoPaymentSignatureWithIntent, readDemoPayment } from "@/lib/x402-demo";

type Payload = {
  prompt?: unknown;
  cliToken?: unknown;
  proxyUrl?: unknown;
  paymentIntent?: Partial<PaymentIntent>;
};

const X402_RESOURCE = "/api/playground/interceptor-test";

function proxyBaseUrl(): string {
  return process.env.ArkivGate_PROXY_URL ?? "";
}

function sanitizeProxyUrl(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function buildPath(cliToken?: string): string {
  if (cliToken && cliToken.trim().length > 0) {
    return `/cli/${encodeURIComponent(cliToken.trim())}/v1/messages`;
  }
  return "/v1/messages";
}

type EmbeddedHit = {
  slug: string;
  action: "BLOCK" | "REDACT" | "WARN" | "LOG";
  layer: "regex" | "pattern" | "nl";
};

const FALLBACK_RULES: Array<{
  slug: string;
  layer: EmbeddedHit["layer"];
  action: EmbeddedHit["action"];
  pattern: RegExp;
}> = [
  {
    slug: "aws-access-key",
    layer: "regex",
    action: "BLOCK",
    pattern: /AKIA[0-9A-Z]{16}/gi,
  },
  {
    slug: "dotenv-paste",
    layer: "regex",
    action: "BLOCK",
    pattern: /(\.env|API_KEY|SECRET_KEY|DATABASE_URL)/gi,
  },
  {
    slug: "email-pii",
    layer: "regex",
    action: "REDACT",
    pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  },
  {
    slug: "phone-pii",
    layer: "regex",
    action: "REDACT",
    pattern: /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)\d{3,4}[\s-]?\d{3,4}/g,
  },
  {
    slug: "client-name",
    layer: "nl",
    action: "WARN",
    pattern: /(acme|globex|initech|umbrella)/gi,
  },
];

function pickAction(actions: Array<EmbeddedHit["action"]>): "BLOCK" | "REDACT" | "WARN" | "LOG" | "PASS" {
  if (actions.includes("BLOCK")) return "BLOCK";
  if (actions.includes("REDACT")) return "REDACT";
  if (actions.includes("WARN")) return "WARN";
  if (actions.includes("LOG")) return "LOG";
  return "PASS";
}

function toPolicyVerdict(action?: "BLOCK" | "REDACT" | "WARN" | "LOG" | "PASS"): PolicyVerdict {
  if (action === "BLOCK" || action === "REDACT" || action === "WARN") return action;
  return "PASS";
}

async function runEmbeddedFallback(prompt: string) {
  const started = Date.now();

  const hits: EmbeddedHit[] = [];
  let sanitized = prompt;

  for (const rule of FALLBACK_RULES) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(prompt)) {
      hits.push({ slug: rule.slug, action: rule.action, layer: rule.layer });
      if (rule.action === "REDACT") {
        sanitized = sanitized.replace(rule.pattern, "[REDACTED]");
      }
    }
  }

  const action = pickAction(hits.map((hit) => hit.action));

  return {
    ok: true,
    status: 200,
    elapsedMs: Date.now() - started,
    mode: "embedded",
    action,
    traceId: `embedded-${crypto.randomUUID().slice(0, 8)}`,
    target: "embedded://web-api",
    upstream: {
      action,
      matched_rules: hits,
      sanitized_prompt: sanitized,
      total_policies: FALLBACK_RULES.length,
    },
    hint: "Usando fallback embebido del web backend. Si configuras ArkivGate_PROXY_URL, se usa el interceptor real automaticamente.",
  };
}

async function persistPromptResult(input: {
  prompt: string;
  traceId: string;
  action?: "BLOCK" | "REDACT" | "WARN" | "LOG" | "PASS";
  severity?: "low" | "medium" | "high" | "critical";
  reason?: string;
  matchedRules?: string[];
  riskScore?: number;
  model: string;
  latencyMs: number;
  agentKey: string;
  paymentPolicy: ReturnType<typeof evaluatePaymentPolicy>;
}) {
  const evaluation = evaluatePromptRisk(input.prompt);
  try {
    const persisted = await persistArkivPromptAudit({
      orgKey: process.env.DEMO_ORG_ID ?? "demo",
      traceId: input.traceId,
      model: input.model,
      prompt: input.prompt,
      promptRedacted: redactPrompt(input.prompt),
      promptHash: promptHash(input.prompt),
      action: input.action && input.action !== "PASS" ? input.action : evaluation.action,
      severity: input.severity ?? evaluation.severity,
      reason: input.reason ?? evaluation.reason,
      matchedRules: input.matchedRules ?? evaluation.matchedRules,
      riskScore: input.riskScore ?? evaluation.riskScore,
      sessionKey: `playground_${input.traceId}`,
      agentKey: input.agentKey,
      agentPaymentRail: "x402-demo",
      paymentPolicy: {
        verdict: input.paymentPolicy.verdict,
        severity: input.paymentPolicy.severity,
        riskScore: input.paymentPolicy.riskScore,
        reason: input.paymentPolicy.reason,
        matchedRules: input.paymentPolicy.matchedRules,
        walletBalanceUsd: input.paymentPolicy.intent.walletBalanceUsd,
        transferUsd: input.paymentPolicy.intent.transferUsd,
        adjustedTransferUsd: input.paymentPolicy.adjustedTransferUsd,
        recentMaxTransferUsd: input.paymentPolicy.intent.recentMaxTransferUsd,
        perTxLimitUsd: input.paymentPolicy.intent.perTxLimitUsd,
        recipientRisk: input.paymentPolicy.intent.recipientRisk,
        recipientAddress: input.paymentPolicy.intent.recipientAddress,
        threatIntel: {
          isFlagged: input.paymentPolicy.threatIntel.isFlagged,
          confidence: input.paymentPolicy.threatIntel.confidence,
          reportCount: input.paymentPolicy.threatIntel.reportCount,
          confirmationCount: input.paymentPolicy.threatIntel.confirmationCount,
          maxSeverity: input.paymentPolicy.threatIntel.maxSeverity,
          dominantThreatType: input.paymentPolicy.threatIntel.dominantThreatType,
          totalAmountLostUsd: input.paymentPolicy.threatIntel.totalAmountLostUsd,
          matchedReportId: input.paymentPolicy.threatIntel.matchedReportId,
          aiSummary: input.paymentPolicy.threatIntel.aiSummary,
        },
      },
      latencyMs: input.latencyMs,
    });

    return {
      policyKey: persisted.policyKey,
      agentEntityKey: persisted.agentEntityKey,
      paymentReviewKey: persisted.paymentReviewKey,
      threatReportKey: persisted.threatReportKey,
      threatConfirmationKey: persisted.threatConfirmationKey,
      promptReviewKey: persisted.promptReviewKey,
      policyDecisionKey: persisted.policyDecisionKey,
      policyTxHash: persisted.policyTxHash,
      agentTxHash: persisted.agentTxHash,
      paymentReviewTxHash: persisted.paymentReviewTxHash,
      threatReportTxHash: persisted.threatReportTxHash,
      threatConfirmationTxHash: persisted.threatConfirmationTxHash,
      promptReviewTxHash: persisted.promptReviewTxHash,
      policyDecisionTxHash: persisted.policyDecisionTxHash,
      explorers: persisted.explorers,
    };
  } catch (error) {
    return {
      error: "arkiv_persist_failed",
      detail: error instanceof Error ? error.message : "unknown error",
    };
  }
}

function buildPolicyEnvelope(input: {
  paymentPolicy: ReturnType<typeof evaluatePaymentPolicy>;
  promptAction?: "BLOCK" | "REDACT" | "WARN" | "LOG" | "PASS";
  promptReason?: string;
  promptMatchedRules?: string[];
}) {
  const promptVerdict = toPolicyVerdict(input.promptAction);
  const finalVerdict = worstVerdict([input.paymentPolicy.verdict, promptVerdict]);
  const promptPolicy = {
    verdict: promptVerdict,
    reason: input.promptReason ?? (promptVerdict === "PASS" ? "prompt is within policy" : "prompt matched protected-content policy"),
    matchedRules: input.promptMatchedRules ?? [],
  };

  return {
    paymentPolicy: input.paymentPolicy,
    promptPolicy,
    finalDecision: {
      verdict: finalVerdict,
      reason:
        finalVerdict === input.paymentPolicy.verdict && input.paymentPolicy.verdict !== "PASS"
          ? input.paymentPolicy.reason
          : promptPolicy.reason,
    },
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Payload | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const cliToken = typeof body?.cliToken === "string" ? body.cliToken : "";
  const proxyUrl =
    typeof body?.proxyUrl === "string"
      ? sanitizeProxyUrl(body.proxyUrl)
      : null;

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const payment = readDemoPayment(request.headers, X402_RESOURCE);
  if (!payment.ok) return payment.response;
  const paymentResponseHeader = payment.responseHeader;
  const payerAgentKey = payment.payment.payer;
  const paymentIntent = normalizePaymentIntent(payment.payment.paymentIntent ?? body?.paymentIntent);
  const paymentPolicy = evaluatePaymentPolicy(paymentIntent);

  function paidJson(body: unknown, init?: ResponseInit) {
    const response = NextResponse.json(body, init);
    appendPaymentResponse(response.headers, paymentResponseHeader);
    return response;
  }

  const resolvedBase = proxyUrl ?? sanitizeProxyUrl(proxyBaseUrl());

  if (paymentPolicy.verdict === "BLOCK") {
    const fallback = await runEmbeddedFallback(prompt);
    const policy = buildPolicyEnvelope({
      paymentPolicy,
      promptAction: fallback.action,
      promptMatchedRules: fallback.upstream.matched_rules.map((hit) => hit.slug),
    });
    const arkiv = await persistPromptResult({
      prompt,
      traceId: fallback.traceId,
      action: "BLOCK",
      severity: "critical",
      reason: policy.finalDecision.reason,
      matchedRules: [
        ...paymentPolicy.matchedRules.map((rule) => `payment:${rule}`),
        ...policy.promptPolicy.matchedRules.map((rule) => `prompt:${rule}`),
      ],
      riskScore: Math.max(paymentPolicy.riskScore, 90),
      model: "claude-sonnet-4-6",
      latencyMs: fallback.elapsedMs,
      agentKey: payerAgentKey,
      paymentPolicy,
    });

    return paidJson({
      ...fallback,
      action: "BLOCK",
      arkiv,
      x402: payment.settlement,
      paymentPolicy,
      promptPolicy: policy.promptPolicy,
      finalDecision: policy.finalDecision,
      hint: "Pago x402 firmado, pero la politica de fondos bloqueo la ejecucion antes del modelo.",
    });
  }

  if (!resolvedBase) {
    const fallback = await runEmbeddedFallback(prompt);
    const policy = buildPolicyEnvelope({
      paymentPolicy,
      promptAction: fallback.action,
      promptMatchedRules: fallback.upstream.matched_rules.map((hit) => hit.slug),
    });
    const arkiv = await persistPromptResult({
      prompt,
      traceId: fallback.traceId,
      action: policy.finalDecision.verdict,
      severity: paymentPolicy.verdict === policy.finalDecision.verdict ? paymentPolicy.severity : undefined,
      reason: policy.finalDecision.reason,
      matchedRules: [
        ...paymentPolicy.matchedRules.map((rule) => `payment:${rule}`),
        ...policy.promptPolicy.matchedRules.map((rule) => `prompt:${rule}`),
      ],
      riskScore: Math.max(paymentPolicy.riskScore, evaluatePromptRisk(prompt).riskScore),
      model: "claude-sonnet-4-6",
      latencyMs: fallback.elapsedMs,
      agentKey: payerAgentKey,
      paymentPolicy,
    });

    return paidJson({
      ...fallback,
      action: policy.finalDecision.verdict,
      arkiv,
      x402: payment.settlement,
      paymentPolicy,
      promptPolicy: policy.promptPolicy,
      finalDecision: policy.finalDecision,
      hint: `${fallback.hint} La ejecucion tambien quedo persistida en Arkiv.`,
    });
  }

  const upstreamPath = buildPath(cliToken);
  const upstreamUrl = `${resolvedBase}${upstreamPath}`;
  const started = Date.now();

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        "PAYMENT-SIGNATURE": buildDemoPaymentSignatureWithIntent(upstreamPath, payerAgentKey, paymentIntent),
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 128,
        stream: false,
        messages: [{ role: "user", content: prompt }],
      }),
      cache: "no-store",
    });

    const elapsedMs = Date.now() - started;
    const text = await upstreamResponse.text();

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    const appNotFound =
      upstreamResponse.status === 404 &&
      typeof parsed === "object" &&
      parsed !== null &&
      "message" in parsed &&
      String((parsed as { message?: unknown }).message).toLowerCase().includes("application not found");

    if (appNotFound) {
      const fallback = await runEmbeddedFallback(prompt);
      const policy = buildPolicyEnvelope({
        paymentPolicy,
        promptAction: fallback.action,
        promptMatchedRules: fallback.upstream.matched_rules.map((hit) => hit.slug),
      });
      const arkiv = await persistPromptResult({
        prompt,
        traceId: fallback.traceId,
        action: policy.finalDecision.verdict,
        severity: paymentPolicy.verdict === policy.finalDecision.verdict ? paymentPolicy.severity : undefined,
        reason: policy.finalDecision.reason,
        matchedRules: [
          ...paymentPolicy.matchedRules.map((rule) => `payment:${rule}`),
          ...policy.promptPolicy.matchedRules.map((rule) => `prompt:${rule}`),
        ],
        riskScore: Math.max(paymentPolicy.riskScore, evaluatePromptRisk(prompt).riskScore),
        model: "claude-sonnet-4-6",
        latencyMs: fallback.elapsedMs,
        agentKey: payerAgentKey,
        paymentPolicy,
      });
      return paidJson({
        ...fallback,
        action: policy.finalDecision.verdict,
        arkiv,
        x402: payment.settlement,
        paymentPolicy,
        promptPolicy: policy.promptPolicy,
        finalDecision: policy.finalDecision,
        hint: "El proxy configurado devolvio 'Application not found'. Se activo fallback embebido automaticamente.",
      });
    }

    if (upstreamResponse.status === 401 && !cliToken) {
      const fallback = await runEmbeddedFallback(prompt);
      const policy = buildPolicyEnvelope({
        paymentPolicy,
        promptAction: fallback.action,
        promptMatchedRules: fallback.upstream.matched_rules.map((hit) => hit.slug),
      });
      const arkiv = await persistPromptResult({
        prompt,
        traceId: fallback.traceId,
        action: policy.finalDecision.verdict,
        severity: paymentPolicy.verdict === policy.finalDecision.verdict ? paymentPolicy.severity : undefined,
        reason: policy.finalDecision.reason,
        matchedRules: [
          ...paymentPolicy.matchedRules.map((rule) => `payment:${rule}`),
          ...policy.promptPolicy.matchedRules.map((rule) => `prompt:${rule}`),
        ],
        riskScore: Math.max(paymentPolicy.riskScore, evaluatePromptRisk(prompt).riskScore),
        model: "claude-sonnet-4-6",
        latencyMs: fallback.elapsedMs,
        agentKey: payerAgentKey,
        paymentPolicy,
      });
      return paidJson({
        ...fallback,
        action: policy.finalDecision.verdict,
        arkiv,
        x402: payment.settlement,
        paymentPolicy,
        promptPolicy: policy.promptPolicy,
        finalDecision: policy.finalDecision,
        hint: "Railway esta online, pero el interceptor requiere CLI token. Para la demo publica se uso fallback embebido.",
      });
    }

    const action =
      (upstreamResponse.headers.get("x-team22-action") as typeof ACTION[keyof typeof ACTION] | null) ??
      undefined;
    const policy = buildPolicyEnvelope({
      paymentPolicy,
      promptAction: action ?? "PASS",
    });
    const arkiv = await persistPromptResult({
      prompt,
      traceId: upstreamResponse.headers.get("x-team22-trace-id") ?? `playground-${crypto.randomUUID().slice(0, 8)}`,
      action: policy.finalDecision.verdict,
      severity: paymentPolicy.verdict === policy.finalDecision.verdict ? paymentPolicy.severity : undefined,
      reason: policy.finalDecision.reason,
      matchedRules: paymentPolicy.matchedRules.map((rule) => `payment:${rule}`),
      riskScore: paymentPolicy.riskScore,
      model: "claude-sonnet-4-6",
      latencyMs: elapsedMs,
      agentKey: payerAgentKey,
      paymentPolicy,
    });

    return paidJson({
      ok: upstreamResponse.ok,
      status: upstreamResponse.status,
      elapsedMs,
      mode: "direct",
      target: upstreamUrl,
      action: policy.finalDecision.verdict,
      traceId: upstreamResponse.headers.get("x-team22-trace-id"),
      upstream: parsed,
      arkiv,
      x402: payment.settlement,
      paymentPolicy,
      promptPolicy: policy.promptPolicy,
      finalDecision: policy.finalDecision,
      hint:
        upstreamResponse.status === 401 && !cliToken
          ? "El interceptor requiere token CLI. Corre npx ArkivGate setup y pega tu token para test real."
          : null,
    });
  } catch (error) {
    const fallback = await runEmbeddedFallback(prompt);
    const policy = buildPolicyEnvelope({
      paymentPolicy,
      promptAction: fallback.action,
      promptMatchedRules: fallback.upstream.matched_rules.map((hit) => hit.slug),
    });
    const arkiv = await persistPromptResult({
      prompt,
      traceId: fallback.traceId,
      action: policy.finalDecision.verdict,
      severity: paymentPolicy.verdict === policy.finalDecision.verdict ? paymentPolicy.severity : undefined,
      reason: policy.finalDecision.reason,
      matchedRules: [
        ...paymentPolicy.matchedRules.map((rule) => `payment:${rule}`),
        ...policy.promptPolicy.matchedRules.map((rule) => `prompt:${rule}`),
      ],
      riskScore: Math.max(paymentPolicy.riskScore, evaluatePromptRisk(prompt).riskScore),
      model: "claude-sonnet-4-6",
      latencyMs: fallback.elapsedMs,
      agentKey: payerAgentKey,
      paymentPolicy,
    });
    return paidJson({
      ...fallback,
      action: policy.finalDecision.verdict,
      arkiv,
      x402: payment.settlement,
      paymentPolicy,
      promptPolicy: policy.promptPolicy,
      finalDecision: policy.finalDecision,
      hint: `No se pudo alcanzar el interceptor (${error instanceof Error ? error.message : "unknown error"}). Fallback embebido activo.`,
    });
  }
}
