"use client";

import { useMemo, useState } from "react";

import {
  evaluatePaymentPolicy,
  normalizePaymentIntent,
  type PaymentIntent,
  type PaymentPolicyResult,
  type PolicyVerdict,
} from "@/lib/payment-policy";
import { DEMO_THREAT_ADDRESS } from "@/lib/threat-intel";
import { buildDemoPaymentSignatureWithIntent } from "@/lib/x402-demo";
import { shortWalletAddress } from "@/lib/wallet/identity";
import { useWalletIdentity } from "./wallet-identity-button";

type RuleAction = "BLOCK" | "REDACT" | "WARN";

type Rule = {
  id: string;
  label: string;
  description: string;
  action: RuleAction;
  pattern: RegExp;
};

const RULES: Rule[] = [
  {
    id: "aws-key",
    label: "AWS key",
    description: "Detecta credentials tipo AKIA...",
    action: "BLOCK",
    pattern: /AKIA[0-9A-Z]{16}/g,
  },
  {
    id: "dotenv",
    label: ".env secret",
    description: "Bloquea menciones de .env o tokens comunes",
    action: "BLOCK",
    pattern: /(\.env|API_KEY|SECRET_KEY|DATABASE_URL)/gi,
  },
  {
    id: "email",
    label: "Email address",
    description: "Redacta direcciones de correo",
    action: "REDACT",
    pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  },
  {
    id: "phone",
    label: "Phone number",
    description: "Redacta telefonos con prefijo opcional",
    action: "REDACT",
    pattern: /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)\d{3,4}[\s-]?\d{3,4}/g,
  },
  {
    id: "client-name",
    label: "Client naming",
    description: "Flags customer mentions for review",
    action: "WARN",
    pattern: /(acme|globex|initech|umbrella)/gi,
  },
];

const PRESETS = [
  "Necesito ayuda con AKIAIOSFODNN7EXAMPLE y mi .env de prod",
  "Envia este reporte a maria@acme.com y llama al +54 11 5555 1212",
  "Resume la reunion interna sin compartir datos sensibles",
];

const X402_RESOURCE = "/api/playground/interceptor-test";
const X402_PRICE = "0.001 USDC";
const X402_NETWORK = "base-sepolia";
const DEFAULT_AGENT_KEY = "agent_arkivgate_x402_demo";

type X402Phase = "idle" | "requesting" | "challenged" | "signed" | "settled";

type X402Settlement = {
  success: true;
  mode: "demo";
  settled: false;
  transaction: string;
  payer: string;
  resource: string;
  amount: string;
  asset: string;
  network: string;
};

type PromptPolicyResult = {
  verdict: PolicyVerdict;
  reason: string;
  matchedRules: string[];
};

type FinalDecision = {
  verdict: PolicyVerdict;
  reason: string;
};

function getSeverity(action: RuleAction | "PASS") {
  if (action === "BLOCK") return 3;
  if (action === "REDACT") return 2;
  if (action === "WARN") return 1;
  return 0;
}

export function PolicyPlayground() {
  const [input, setInput] = useState(PRESETS[0]);
  const [enabledRuleIds, setEnabledRuleIds] = useState<string[]>(RULES.map((r) => r.id));
  const [copied, setCopied] = useState(false);
  const [cliToken, setCliToken] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [x402AgentKey, setX402AgentKey] = useState(DEFAULT_AGENT_KEY);
  const [walletBalanceUsd, setWalletBalanceUsd] = useState(100);
  const [transferUsd, setTransferUsd] = useState(12);
  const [recentMaxTransferUsd, setRecentMaxTransferUsd] = useState(20);
  const [perTxLimitUsd, setPerTxLimitUsd] = useState(40);
  const [recipientRisk, setRecipientRisk] = useState<PaymentIntent["recipientRisk"]>("low");
  const [recipientAddress, setRecipientAddress] = useState(DEMO_THREAT_ADDRESS);
  const [x402Phase, setX402Phase] = useState<X402Phase>("idle");
  const [runningLiveTest, setRunningLiveTest] = useState(false);
  const [attemptStatus, setAttemptStatus] = useState<{
    prompt: string;
    source: "sample" | "manual";
  } | null>(null);
  const [liveResult, setLiveResult] = useState<{
    ok: boolean;
    status: number;
    elapsedMs: number;
    mode?: string;
    target?: string;
    action?: string | null;
    traceId?: string | null;
    hint?: string | null;
    upstream?: unknown;
    x402?: X402Settlement;
    paymentPolicy?: PaymentPolicyResult;
    promptPolicy?: PromptPolicyResult;
    finalDecision?: FinalDecision;
    arkiv?: {
      policyKey?: string;
      policyTxHash?: string;
      agentEntityKey?: string;
      agentTxHash?: string;
      paymentReviewKey?: string;
      paymentReviewTxHash?: string;
      threatReportKey?: string;
      threatReportTxHash?: string;
      threatConfirmationKey?: string;
      threatConfirmationTxHash?: string;
      promptReviewKey?: string;
      promptReviewTxHash?: string;
      policyDecisionKey?: string;
      policyDecisionTxHash?: string;
      explorers?: {
        policy?: string;
        agent: string;
        paymentReview?: string;
        threatReport?: string;
        threatConfirmation?: string;
        promptReview: string;
        policyDecision: string;
        policyTx?: string;
        agentTx: string;
        paymentReviewTx?: string;
        threatReportTx?: string;
        threatConfirmationTx?: string;
        promptReviewTx: string;
        policyDecisionTx: string;
      };
    };
    error?: string;
    detail?: string;
  } | null>(null);
  const connectedWallet = useWalletIdentity();
  const effectivePayer = connectedWallet.agentKey ?? x402AgentKey.trim() ?? DEFAULT_AGENT_KEY;

  const result = useMemo(() => {
    const enabledRules = RULES.filter((rule) => enabledRuleIds.includes(rule.id));
    const matches = enabledRules.filter((rule) => {
      rule.pattern.lastIndex = 0;
      return rule.pattern.test(input);
    });

    const action =
      matches
        .map((rule) => rule.action)
        .sort((a, b) => getSeverity(b) - getSeverity(a))[0] ?? "PASS";

    let sanitized = input;
    for (const rule of matches) {
      if (rule.action === "REDACT") {
        sanitized = sanitized.replace(rule.pattern, "[REDACTED]");
      }
    }

    return {
      action,
      matches,
      sanitized,
    };
  }, [enabledRuleIds, input]);

  const paymentIntent = useMemo(
    () =>
      normalizePaymentIntent({
        walletBalanceUsd,
        transferUsd,
        recentMaxTransferUsd,
        perTxLimitUsd,
        recipientRisk,
        recipientAddress,
      }),
    [perTxLimitUsd, recentMaxTransferUsd, recipientAddress, recipientRisk, transferUsd, walletBalanceUsd],
  );

  const paymentPreview = useMemo(() => evaluatePaymentPolicy(paymentIntent), [paymentIntent]);

  function toggleRule(id: string) {
    setEnabledRuleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(result.sanitized);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Ignore clipboard failures in restricted browsers.
    }
  }

  async function runLiveTest(promptOverride?: string, source: "sample" | "manual" = "manual") {
    const promptToTest = (promptOverride ?? input).trim();
    if (!promptToTest || runningLiveTest) return;

    setAttemptStatus({ prompt: promptToTest, source });
    setRunningLiveTest(true);
    setX402Phase("requesting");
    setLiveResult(null);
    try {
      const requestBody = JSON.stringify({ prompt: promptToTest, cliToken, proxyUrl, paymentIntent });
      let response = await fetch("/api/playground/interceptor-test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: requestBody,
      });
      const requiredPayment = response.headers.get("PAYMENT-REQUIRED");

      if (response.status === 402 && requiredPayment) {
        setX402Phase("challenged");
        response = await fetch("/api/playground/interceptor-test", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "PAYMENT-SIGNATURE": buildDemoPaymentSignatureWithIntent(X402_RESOURCE, effectivePayer, paymentIntent),
          },
          body: requestBody,
        });
        setX402Phase("signed");
      }

      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        status?: number;
        elapsedMs?: number;
        mode?: string;
        target?: string;
        action?: string | null;
        traceId?: string | null;
        hint?: string | null;
        upstream?: unknown;
        x402?: X402Settlement;
        paymentPolicy?: PaymentPolicyResult;
        promptPolicy?: PromptPolicyResult;
        finalDecision?: FinalDecision;
        arkiv?: {
          policyKey?: string;
          policyTxHash?: string;
          agentEntityKey?: string;
          agentTxHash?: string;
          paymentReviewKey?: string;
          paymentReviewTxHash?: string;
          promptReviewKey?: string;
          promptReviewTxHash?: string;
          policyDecisionKey?: string;
          policyDecisionTxHash?: string;
          explorers?: {
            policy?: string;
            agent: string;
            paymentReview?: string;
            promptReview: string;
            policyDecision: string;
            policyTx?: string;
            agentTx: string;
            paymentReviewTx?: string;
            promptReviewTx: string;
            policyDecisionTx: string;
          };
        };
        error?: string;
        detail?: string;
      } | null;

      if (!data) {
        setLiveResult({
          ok: false,
          status: response.status,
          elapsedMs: 0,
          error: "invalid response",
        });
        return;
      }

      setLiveResult({
        ok: Boolean(data.ok),
        status: data.status ?? response.status,
        elapsedMs: data.elapsedMs ?? 0,
        mode: data.mode,
        target: data.target,
        action: data.action,
        traceId: data.traceId,
        hint: data.hint,
        upstream: data.upstream,
        x402: data.x402,
        paymentPolicy: data.paymentPolicy,
        promptPolicy: data.promptPolicy,
        finalDecision: data.finalDecision,
        arkiv: data.arkiv,
        error: data.error,
        detail: data.detail,
      });
      setX402Phase(data.x402 ? "settled" : "idle");
    } catch (error) {
      setLiveResult({
        ok: false,
        status: 500,
        elapsedMs: 0,
        error: "request failed",
        detail: error instanceof Error ? error.message : "unknown error",
      });
      setX402Phase("idle");
    } finally {
      setRunningLiveTest(false);
    }
  }

  function runPresetAttempt(preset: string) {
    setInput(preset);
    void runLiveTest(preset, "sample");
  }

  const showAttemptStatus = attemptStatus !== null;

  return (
    <section id="playground" className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
      {showAttemptStatus ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#092126]/55 px-4 py-8">
          <div className="w-full max-w-2xl border border-[#1b5a65]/25 bg-paper p-5 shadow-2xl" style={{ borderRadius: "8px" }}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#1b5a65]">
                  {attemptStatus.source === "sample" ? "example prompt status" : "prompt status"}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-ink">
                  {runningLiveTest ? "Procesando intento..." : "Intento registrado"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAttemptStatus(null)}
                className="border border-[#7a8f93]/35 bg-white px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-graphite transition-colors hover:bg-[#f3f6f6]"
                style={{ borderRadius: "6px" }}
              >
                close
              </button>
            </div>

            <div className="space-y-3">
              <div className="border border-[#1b5a65]/15 bg-[#f7fbfa] p-3 text-sm text-ink" style={{ borderRadius: "6px" }}>
                {attemptStatus.prompt}
              </div>

              {runningLiveTest ? (
                <div className="space-y-2 border border-[#1b5a65]/15 bg-white p-4 text-sm text-graphite-dark" style={{ borderRadius: "6px" }}>
                  <p>Negotiating x402 payment, running policy, and persisting evidence on Arkiv...</p>
                  <div className="grid gap-2 text-xs md:grid-cols-4">
                    <StepPill active={x402Phase !== "idle"} label="request" />
                    <StepPill active={x402Phase === "challenged" || x402Phase === "signed" || x402Phase === "settled"} label="402" />
                    <StepPill active={x402Phase === "signed" || x402Phase === "settled"} label="signature" />
                    <StepPill active={x402Phase === "settled"} label="arkiv" />
                  </div>
                </div>
              ) : liveResult ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="border border-[#1b5a65]/25 bg-white px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#1b5a65]" style={{ borderRadius: "6px" }}>
                      status: {liveResult.status}
                    </span>
                    <span className="border border-[#1b5a65]/25 bg-white px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#1b5a65]" style={{ borderRadius: "6px" }}>
                      action: {liveResult.action ?? "n/a"}
                    </span>
                    <span className="border border-[#1b5a65]/25 bg-white px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#1b5a65]" style={{ borderRadius: "6px" }}>
                      latency: {liveResult.elapsedMs}ms
                    </span>
                    {liveResult.x402 ? (
                      <span className="border border-[#2e6659]/30 bg-[#e4f4ef] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#2e6659]" style={{ borderRadius: "6px" }}>
                        x402: paid demo
                      </span>
                    ) : null}
                  </div>

                  {liveResult.traceId ? (
                    <p className="text-xs text-graphite-dark">trace: {liveResult.traceId}</p>
                  ) : null}

                  {liveResult.arkiv?.explorers ? (
                    <div className="space-y-2 border border-[#1b5a65]/15 bg-white p-4 text-sm text-ink" style={{ borderRadius: "6px" }}>
                      <p className="font-mono text-xs uppercase tracking-[0.14em] text-graphite">arkiv evidence</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <a
                          href={liveResult.arkiv.explorers.promptReviewTx}
                          target="_blank"
                          rel="noreferrer"
                          className="border border-[#1b5a65]/25 bg-[#edf5f4] px-2.5 py-1 font-mono uppercase tracking-[0.12em] text-[#1b5a65] transition-colors hover:bg-[#e1edeb]"
                          style={{ borderRadius: "6px" }}
                        >
                          prompt review tx
                        </a>
                        <a
                          href={liveResult.arkiv.explorers.policyDecisionTx}
                          target="_blank"
                          rel="noreferrer"
                          className="border border-[#1b5a65]/25 bg-[#edf5f4] px-2.5 py-1 font-mono uppercase tracking-[0.12em] text-[#1b5a65] transition-colors hover:bg-[#e1edeb]"
                          style={{ borderRadius: "6px" }}
                        >
                          policy decision tx
                        </a>
                        <a
                          href={liveResult.arkiv.explorers.agent}
                          target="_blank"
                          rel="noreferrer"
                          className="border border-[#1b5a65]/25 bg-[#edf5f4] px-2.5 py-1 font-mono uppercase tracking-[0.12em] text-[#1b5a65] transition-colors hover:bg-[#e1edeb]"
                          style={{ borderRadius: "6px" }}
                        >
                          paying agent entity
                        </a>
                        {liveResult.arkiv.explorers.agentTx ? (
                          <a
                            href={liveResult.arkiv.explorers.agentTx}
                            target="_blank"
                            rel="noreferrer"
                            className="border border-[#1b5a65]/25 bg-white px-2.5 py-1 font-mono uppercase tracking-[0.12em] text-[#1b5a65] transition-colors hover:bg-[#edf5f4]"
                            style={{ borderRadius: "6px" }}
                          >
                            agent tx
                          </a>
                        ) : null}
                        <a
                          href={liveResult.arkiv.explorers.promptReview}
                          target="_blank"
                          rel="noreferrer"
                          className="border border-[#1b5a65]/25 bg-white px-2.5 py-1 font-mono uppercase tracking-[0.12em] text-[#1b5a65] transition-colors hover:bg-[#edf5f4]"
                          style={{ borderRadius: "6px" }}
                        >
                          prompt review entity
                        </a>
                        <a
                          href={liveResult.arkiv.explorers.policyDecision}
                          target="_blank"
                          rel="noreferrer"
                          className="border border-[#1b5a65]/25 bg-white px-2.5 py-1 font-mono uppercase tracking-[0.12em] text-[#1b5a65] transition-colors hover:bg-[#edf5f4]"
                          style={{ borderRadius: "6px" }}
                        >
                          policy decision entity
                        </a>
                        {liveResult.arkiv.explorers.policyTx ? (
                          <a
                            href={liveResult.arkiv.explorers.policyTx}
                            target="_blank"
                            rel="noreferrer"
                            className="border border-[#1b5a65]/25 bg-white px-2.5 py-1 font-mono uppercase tracking-[0.12em] text-[#1b5a65] transition-colors hover:bg-[#edf5f4]"
                            style={{ borderRadius: "6px" }}
                          >
                            policy tx
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {liveResult.hint ? <p className="text-sm text-[#8a5f1f]">{liveResult.hint}</p> : null}
                  {liveResult.error ? <p className="text-sm text-[#8a2d2d]">{liveResult.error}: {liveResult.detail}</p> : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#1b5a65]">interactive</p>
          <h2 className="mt-2 text-2xl font-semibold md:text-3xl">Policy Playground</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className="inline-flex items-center border border-[#2e6659]/30 bg-[#e4f4ef] px-3 py-1 font-mono text-xs uppercase tracking-[0.14em] text-[#2e6659]"
            style={{ borderRadius: "6px" }}
          >
            x402 agent rail
          </span>
          <span
            className={`inline-flex items-center border px-3 py-1 font-mono text-xs uppercase tracking-[0.14em] ${
              result.action === "BLOCK"
                ? "border-[#8a2d2d] bg-[#f8e7e7] text-[#8a2d2d]"
                : result.action === "REDACT"
                  ? "border-[#8a5f1f] bg-[#fff4e3] text-[#8a5f1f]"
                  : result.action === "WARN"
                    ? "border-[#385f88] bg-[#e8f2ff] text-[#385f88]"
                    : "border-[#2e6659] bg-[#e4f4ef] text-[#2e6659]"
            }`}
            style={{ borderRadius: "6px" }}
          >
            verdict: {result.action}
          </span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <article className="border border-[#1b5a65]/25 bg-paper p-5" style={{ borderRadius: "6px" }}>
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-graphite">input prompt</p>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="h-36 w-full resize-y border border-[#1b5a65]/25 bg-[#f7fbfa] p-3 text-sm leading-relaxed text-ink outline-none focus:border-[#1b5a65]"
            style={{ borderRadius: "6px" }}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => runPresetAttempt(preset)}
                disabled={runningLiveTest}
                className="border border-[#1b5a65]/25 bg-white px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#1b5a65] transition-colors hover:bg-[#edf5f4]"
                style={{ borderRadius: "6px" }}
              >
                sample
              </button>
            ))}
            <button
              type="button"
              onClick={() => setInput("")}
              className="border border-[#7a8f93]/35 bg-white px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-graphite transition-colors hover:bg-[#f3f6f6]"
              style={{ borderRadius: "6px" }}
            >
              limpiar
            </button>
          </div>
        </article>

        <article className="border border-[#1b5a65]/25 bg-[#f3f8f7] p-5" style={{ borderRadius: "6px" }}>
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-graphite">policy set</p>
          <div className="space-y-2">
            {RULES.map((rule) => {
              const checked = enabledRuleIds.includes(rule.id);
              return (
                <label
                  key={rule.id}
                  className="flex cursor-pointer items-start gap-3 border border-[#1b5a65]/15 bg-white p-3"
                  style={{ borderRadius: "6px" }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRule(rule.id)}
                    className="mt-1 h-3.5 w-3.5 accent-[#1b5a65]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink">{rule.label}</span>
                    <span className="block text-xs text-graphite-dark">{rule.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </article>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <article className="border border-[#1b5a65]/25 bg-white p-5" style={{ borderRadius: "6px" }}>
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-graphite">triggered rules</p>
          {result.matches.length === 0 ? (
            <p className="text-sm text-graphite-dark">No rule matched. Prompt can pass to upstream model.</p>
          ) : (
            <ul className="space-y-2">
              {result.matches.map((match) => (
                <li key={match.id} className="border border-[#1b5a65]/15 bg-[#f6fbfa] px-3 py-2 text-sm" style={{ borderRadius: "6px" }}>
                  <span className="font-medium text-[#123c45]">{match.label}</span>
                  <span className="ml-2 font-mono text-xs uppercase tracking-[0.12em] text-graphite">{match.action}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="border border-[#1b5a65]/25 bg-white p-5" style={{ borderRadius: "6px" }}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-graphite">sanitized output</p>
            <button
              type="button"
              onClick={copyOutput}
              className="border border-[#1b5a65]/25 bg-[#edf5f4] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#1b5a65] transition-colors hover:bg-[#e1edeb]"
              style={{ borderRadius: "6px" }}
            >
              {copied ? "copied" : "copy"}
            </button>
          </div>
          <pre className="min-h-24 whitespace-pre-wrap border border-[#1b5a65]/15 bg-[#f7fbfa] p-3 text-sm leading-relaxed text-ink" style={{ borderRadius: "6px" }}>
            {result.sanitized || "(sin contenido)"}
          </pre>
        </article>
      </div>

      <article className="mt-6 border border-[#1b5a65]/25 bg-[#f7fbfa] p-5" style={{ borderRadius: "6px" }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-graphite">paid agent execution</p>
            <p className="mt-1 text-sm text-graphite-dark">
              El agente recibe 402, firma el pago demo y queda registrado como entidad Arkiv.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void runLiveTest(undefined, "manual")}
            disabled={runningLiveTest || input.trim().length === 0}
            className="border border-[#1b5a65]/25 bg-[#1b5a65] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#144a53] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderRadius: "6px" }}
          >
            {runningLiveTest ? "pagando..." : "run paid agent"}
          </button>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <RailMetric label="price" value={X402_PRICE} />
          <RailMetric label="network" value={X402_NETWORK} />
          <RailMetric label="resource" value={X402_RESOURCE} />
          <RailMetric label="settlement" value="demo" />
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <PolicyLane
            title="x402 payment policy"
            verdict={paymentPreview.verdict}
            reason={paymentPreview.reason}
            detail={
              paymentPreview.adjustedTransferUsd
                ? `cap: $${paymentPreview.adjustedTransferUsd}`
                : `move: $${paymentIntent.transferUsd} / balance: $${paymentIntent.walletBalanceUsd}`
            }
          />
          <PolicyLane
            title="prompt policy"
            verdict={result.action}
            reason={result.matches.length ? result.matches.map((rule) => rule.label).join(", ") : "prompt is within policy"}
            detail={`${result.matches.length} matched rules`}
          />
          <PolicyLane
            title="Arkiv threat intel"
            verdict={paymentPreview.threatIntel.verdict}
            reason={paymentPreview.threatIntel.aiSummary}
            detail={
              paymentPreview.threatIntel.isFlagged
                ? `${paymentPreview.threatIntel.confirmationCount} confirmations / severity ${paymentPreview.threatIntel.maxSeverity}`
                : "no active report"
            }
          />
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-5">
          <NumericField label="Wallet balance" value={walletBalanceUsd} onChange={setWalletBalanceUsd} />
          <NumericField label="Transfer amount" value={transferUsd} onChange={setTransferUsd} />
          <NumericField label="Recent max" value={recentMaxTransferUsd} onChange={setRecentMaxTransferUsd} />
          <NumericField label="Tx cap" value={perTxLimitUsd} onChange={setPerTxLimitUsd} />
          <label className="block text-xs text-graphite-dark">
            Recipient risk
            <select
              value={recipientRisk}
              onChange={(event) => setRecipientRisk(event.target.value as PaymentIntent["recipientRisk"])}
              className="mt-1.5 h-[38px] w-full border border-[#1b5a65]/25 bg-white px-2 text-sm text-ink outline-none focus:border-[#1b5a65]"
              style={{ borderRadius: "6px" }}
            >
              <option value="low">low</option>
              <option value="unknown">unknown</option>
              <option value="high">high</option>
            </select>
          </label>
        </div>

        <label className="mb-3 block text-xs text-graphite-dark">
          Recipient address
          <div className="mt-1.5 flex gap-2">
            <input
              value={recipientAddress}
              onChange={(event) => setRecipientAddress(event.target.value)}
              placeholder="0x..."
              className="min-w-0 flex-1 border border-[#1b5a65]/25 bg-white p-2 font-mono text-xs text-ink outline-none focus:border-[#1b5a65]"
              style={{ borderRadius: "6px" }}
            />
            <button
              type="button"
              onClick={() => setRecipientAddress(DEMO_THREAT_ADDRESS)}
              className="border border-[#1b5a65]/25 bg-white px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#1b5a65]"
              style={{ borderRadius: "6px" }}
            >
              flagged
            </button>
          </div>
          <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-graphite">
            checked against ArkivGate threat reports before execution
          </span>
        </label>

        <label className="mb-3 block text-xs text-graphite-dark">
          Paying agent key
          <input
            value={x402AgentKey}
            onChange={(event) => setX402AgentKey(event.target.value)}
            disabled={connectedWallet.connected}
            placeholder={DEFAULT_AGENT_KEY}
            className="mt-1.5 w-full border border-[#1b5a65]/25 bg-white p-2 text-sm text-ink outline-none focus:border-[#1b5a65] disabled:bg-[#eef5f4] disabled:text-graphite-dark"
            style={{ borderRadius: "6px" }}
          />
          {connectedWallet.connected ? (
            <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-[#1b5a65]">
              paying as connected wallet {shortWalletAddress(connectedWallet.address, 6)}
            </span>
          ) : null}
        </label>

        <label className="mb-3 block text-xs text-graphite-dark">
          Proxy URL (interceptor)
          <input
            value={proxyUrl}
            onChange={(event) => setProxyUrl(event.target.value)}
            placeholder="deja vacio para auto / fallback embebido"
            className="mt-1.5 w-full border border-[#1b5a65]/25 bg-white p-2 text-sm text-ink outline-none focus:border-[#1b5a65]"
            style={{ borderRadius: "6px" }}
          />
        </label>

        <label className="mb-3 block text-xs text-graphite-dark">
          CLI token (opcional, requerido si el interceptor protege /v1/messages)
          <input
            value={cliToken}
            onChange={(event) => setCliToken(event.target.value)}
            placeholder="pega tu token de ArkivGate setup"
            className="mt-1.5 w-full border border-[#1b5a65]/25 bg-white p-2 text-sm text-ink outline-none focus:border-[#1b5a65]"
            style={{ borderRadius: "6px" }}
          />
        </label>

        {!liveResult ? (
          <p className="text-sm text-graphite-dark">Ejecuta test real para validar la respuesta del interceptor con este prompt.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className="border border-[#1b5a65]/25 bg-white px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#1b5a65]" style={{ borderRadius: "6px" }}>
                status: {liveResult.status}
              </span>
              <span className="border border-[#1b5a65]/25 bg-white px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#1b5a65]" style={{ borderRadius: "6px" }}>
                latency: {liveResult.elapsedMs}ms
              </span>
              <span className="border border-[#1b5a65]/25 bg-white px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#1b5a65]" style={{ borderRadius: "6px" }}>
                action: {liveResult.action ?? "n/a"}
              </span>
              <span className="border border-[#1b5a65]/25 bg-white px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#1b5a65]" style={{ borderRadius: "6px" }}>
                mode: {liveResult.mode ?? "unknown"}
              </span>
              {liveResult.x402 ? (
                <span className="border border-[#2e6659]/30 bg-[#e4f4ef] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#2e6659]" style={{ borderRadius: "6px" }}>
                  x402: {liveResult.x402.amount} {liveResult.x402.asset}
                </span>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              {liveResult.paymentPolicy ? (
                <PolicyLane
                  title="x402 payment policy"
                  verdict={liveResult.paymentPolicy.verdict}
                  reason={liveResult.paymentPolicy.reason}
                  detail={
                    liveResult.paymentPolicy.adjustedTransferUsd
                      ? `capped to $${liveResult.paymentPolicy.adjustedTransferUsd}`
                      : `risk ${liveResult.paymentPolicy.riskScore}`
                  }
                />
              ) : null}
              {liveResult.paymentPolicy ? (
                <PolicyLane
                  title="Arkiv threat intel"
                  verdict={liveResult.paymentPolicy.threatIntel.verdict}
                  reason={liveResult.paymentPolicy.threatIntel.aiSummary}
                  detail={
                    liveResult.paymentPolicy.threatIntel.isFlagged
                      ? `${liveResult.paymentPolicy.threatIntel.confirmationCount} confirmations`
                      : "no active report"
                  }
                />
              ) : null}
              {liveResult.promptPolicy ? (
                <PolicyLane
                  title="prompt policy"
                  verdict={liveResult.promptPolicy.verdict}
                  reason={liveResult.promptPolicy.reason}
                  detail={`${liveResult.promptPolicy.matchedRules.length} matched rules`}
                />
              ) : null}
              {liveResult.finalDecision ? (
                <PolicyLane
                  title="final decision"
                  verdict={liveResult.finalDecision.verdict}
                  reason={liveResult.finalDecision.reason}
                  detail="worst severity wins"
                />
              ) : null}
            </div>

            {liveResult.traceId ? (
              <p className="text-xs text-graphite-dark">trace: {liveResult.traceId}</p>
            ) : null}
            {liveResult.target ? (
              <p className="text-xs text-graphite-dark">target: {liveResult.target}</p>
            ) : null}
            {liveResult.x402 ? (
              <p className="text-xs text-graphite-dark">
                payer agent: {liveResult.x402.payer} / payment: {liveResult.x402.transaction}
              </p>
            ) : null}
            {liveResult.hint ? <p className="text-sm text-[#8a5f1f]">{liveResult.hint}</p> : null}
            {liveResult.error ? <p className="text-sm text-[#8a2d2d]">{liveResult.error}: {liveResult.detail}</p> : null}

            {liveResult.arkiv?.promptReviewKey ? (
              <div className="space-y-2 border border-[#1b5a65]/15 bg-white p-3 text-xs text-graphite-dark" style={{ borderRadius: "6px" }}>
                <p className="font-mono uppercase tracking-[0.12em] text-graphite">arkiv persisted</p>
                <p>agent: {liveResult.arkiv.agentEntityKey}</p>
                <p>agent tx: {liveResult.arkiv.agentTxHash}</p>
                {liveResult.arkiv.paymentReviewKey ? <p>payment_review: {liveResult.arkiv.paymentReviewKey}</p> : null}
                {liveResult.arkiv.paymentReviewTxHash ? <p>payment_review tx: {liveResult.arkiv.paymentReviewTxHash}</p> : null}
                {liveResult.arkiv.threatReportKey ? <p>threat_report: {liveResult.arkiv.threatReportKey}</p> : null}
                {liveResult.arkiv.threatReportTxHash ? <p>threat_report tx: {liveResult.arkiv.threatReportTxHash}</p> : null}
                {liveResult.arkiv.threatConfirmationKey ? <p>threat_confirmation: {liveResult.arkiv.threatConfirmationKey}</p> : null}
                {liveResult.arkiv.threatConfirmationTxHash ? <p>threat_confirmation tx: {liveResult.arkiv.threatConfirmationTxHash}</p> : null}
                <p>policy: {liveResult.arkiv.policyKey}</p>
                {liveResult.arkiv.policyTxHash ? <p>policy tx: {liveResult.arkiv.policyTxHash}</p> : null}
                <p>prompt_review: {liveResult.arkiv.promptReviewKey}</p>
                <p>prompt_review tx: {liveResult.arkiv.promptReviewTxHash}</p>
                <p>policy_decision: {liveResult.arkiv.policyDecisionKey}</p>
                <p>policy_decision tx: {liveResult.arkiv.policyDecisionTxHash}</p>
              </div>
            ) : null}

            <pre className="max-h-72 overflow-auto whitespace-pre-wrap border border-[#1b5a65]/15 bg-white p-3 text-xs leading-relaxed text-ink" style={{ borderRadius: "6px" }}>
              {JSON.stringify(liveResult.upstream ?? {}, null, 2)}
            </pre>
          </div>
        )}
      </article>
    </section>
  );
}

function StepPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`border px-2.5 py-1 text-center font-mono text-[10px] uppercase tracking-[0.12em] ${
        active
          ? "border-[#2e6659]/30 bg-[#e4f4ef] text-[#2e6659]"
          : "border-[#7a8f93]/25 bg-[#f7fbfa] text-graphite"
      }`}
      style={{ borderRadius: "6px" }}
    >
      {label}
    </span>
  );
}

function NumericField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-xs text-graphite-dark">
      {label}
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5 h-[38px] w-full border border-[#1b5a65]/25 bg-white px-2 text-sm text-ink outline-none focus:border-[#1b5a65]"
        style={{ borderRadius: "6px" }}
      />
    </label>
  );
}

function PolicyLane({
  title,
  verdict,
  reason,
  detail,
}: {
  title: string;
  verdict: PolicyVerdict;
  reason: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 border border-[#1b5a65]/15 bg-white p-3" style={{ borderRadius: "6px" }}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite">{title}</p>
        <span
          className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${verdictTone(verdict)}`}
          style={{ borderRadius: "6px" }}
        >
          {verdict}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-[#123c45]">{reason}</p>
      <p className="mt-2 break-all font-mono text-[10px] uppercase tracking-[0.12em] text-graphite">{detail}</p>
    </div>
  );
}

function RailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border border-[#1b5a65]/15 bg-white p-3" style={{ borderRadius: "6px" }}>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite">{label}</p>
      <p className="mt-1 break-all text-sm font-medium text-[#123c45]">{value}</p>
    </div>
  );
}

function verdictTone(verdict: PolicyVerdict) {
  if (verdict === "BLOCK") return "border-[#8a2d2d] bg-[#f8e7e7] text-[#8a2d2d]";
  if (verdict === "REDACT") return "border-[#8a5f1f] bg-[#fff4e3] text-[#8a5f1f]";
  if (verdict === "WARN") return "border-[#385f88] bg-[#e8f2ff] text-[#385f88]";
  return "border-[#2e6659] bg-[#e4f4ef] text-[#2e6659]";
}
