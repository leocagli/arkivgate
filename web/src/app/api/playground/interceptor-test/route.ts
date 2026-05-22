import { NextResponse } from "next/server";

import { ACTION } from "@/lib/arkiv/constants";
import { evaluatePromptRisk, promptHash, redactPrompt } from "@/lib/arkiv/mappers";
import { persistArkivPromptAudit } from "@/lib/arkiv/playground-audit";

type Payload = {
  prompt?: unknown;
  cliToken?: unknown;
  proxyUrl?: unknown;
};

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
  model: string;
  latencyMs: number;
}) {
  const evaluation = evaluatePromptRisk(input.prompt);
  const persisted = await persistArkivPromptAudit({
    orgKey: process.env.DEMO_ORG_ID ?? "demo",
    traceId: input.traceId,
    model: input.model,
    prompt: input.prompt,
    promptRedacted: redactPrompt(input.prompt),
    promptHash: promptHash(input.prompt),
    action: input.action && input.action !== "PASS" ? input.action : evaluation.action,
    severity: evaluation.severity,
    reason: evaluation.reason,
    matchedRules: evaluation.matchedRules,
    riskScore: evaluation.riskScore,
    sessionKey: `playground_${input.traceId}`,
    agentKey: "agent_arkivgate_playground",
    latencyMs: input.latencyMs,
  });

  return {
    policyKey: persisted.policyKey,
    promptReviewKey: persisted.promptReviewKey,
    policyDecisionKey: persisted.policyDecisionKey,
    policyTxHash: persisted.policyTxHash,
    promptReviewTxHash: persisted.promptReviewTxHash,
    policyDecisionTxHash: persisted.policyDecisionTxHash,
    explorers: persisted.explorers,
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

  const resolvedBase = proxyUrl ?? sanitizeProxyUrl(proxyBaseUrl());

  if (!resolvedBase) {
    const fallback = await runEmbeddedFallback(prompt);
    const arkiv = await persistPromptResult({
      prompt,
      traceId: fallback.traceId,
      action: fallback.action,
      model: "claude-sonnet-4-6",
      latencyMs: fallback.elapsedMs,
    });

    return NextResponse.json({
      ...fallback,
      arkiv,
      hint: `${fallback.hint} La ejecucion tambien quedo persistida en Arkiv.`,
    });
  }

  const upstreamUrl = `${resolvedBase}${buildPath(cliToken)}`;
  const started = Date.now();

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
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
      const arkiv = await persistPromptResult({
        prompt,
        traceId: fallback.traceId,
        action: fallback.action,
        model: "claude-sonnet-4-6",
        latencyMs: fallback.elapsedMs,
      });
      return NextResponse.json({
        ...fallback,
        arkiv,
        hint: "El proxy configurado devolvio 'Application not found'. Se activo fallback embebido automaticamente.",
      });
    }

    const action =
      (upstreamResponse.headers.get("x-team22-action") as typeof ACTION[keyof typeof ACTION] | null) ??
      undefined;
    const arkiv = await persistPromptResult({
      prompt,
      traceId: upstreamResponse.headers.get("x-team22-trace-id") ?? `playground-${crypto.randomUUID().slice(0, 8)}`,
      action: action ?? undefined,
      model: "claude-sonnet-4-6",
      latencyMs: elapsedMs,
    });

    return NextResponse.json({
      ok: upstreamResponse.ok,
      status: upstreamResponse.status,
      elapsedMs,
      mode: "direct",
      target: upstreamUrl,
      action,
      traceId: upstreamResponse.headers.get("x-team22-trace-id"),
      upstream: parsed,
      arkiv,
      hint:
        upstreamResponse.status === 401 && !cliToken
          ? "El interceptor requiere token CLI. Corre npx ArkivGate setup y pega tu token para test real."
          : null,
    });
  } catch (error) {
    const fallback = await runEmbeddedFallback(prompt);
    const arkiv = await persistPromptResult({
      prompt,
      traceId: fallback.traceId,
      action: fallback.action,
      model: "claude-sonnet-4-6",
      latencyMs: fallback.elapsedMs,
    });
    return NextResponse.json({
      ...fallback,
      arkiv,
      hint: `No se pudo alcanzar el interceptor (${error instanceof Error ? error.message : "unknown error"}). Fallback embebido activo.`,
    });
  }
}
