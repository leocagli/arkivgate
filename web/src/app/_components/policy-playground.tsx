"use client";

import { useMemo, useState } from "react";

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
    description: "Detecta credenciales tipo AKIA...",
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
    description: "Marca menciones de clientes para revision",
    action: "WARN",
    pattern: /(acme|globex|initech|umbrella)/gi,
  },
];

const PRESETS = [
  "Necesito ayuda con AKIAIOSFODNN7EXAMPLE y mi .env de prod",
  "Envia este reporte a maria@acme.com y llama al +54 11 5555 1212",
  "Resume la reunion interna sin compartir datos sensibles",
];

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
  const [runningLiveTest, setRunningLiveTest] = useState(false);
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
    arkiv?: {
      policyKey?: string;
      promptReviewKey?: string;
      policyDecisionKey?: string;
      explorers?: {
        policy: string;
        promptReview: string;
        policyDecision: string;
      };
    };
    error?: string;
    detail?: string;
  } | null>(null);

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

  async function runLiveTest() {
    setRunningLiveTest(true);
    setLiveResult(null);
    try {
      const response = await fetch("/api/playground/interceptor-test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: input, cliToken, proxyUrl }),
      });

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
        arkiv?: {
          policyKey?: string;
          promptReviewKey?: string;
          policyDecisionKey?: string;
          explorers?: {
            policy: string;
            promptReview: string;
            policyDecision: string;
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
        arkiv: data.arkiv,
        error: data.error,
        detail: data.detail,
      });
    } catch (error) {
      setLiveResult({
        ok: false,
        status: 500,
        elapsedMs: 0,
        error: "request failed",
        detail: error instanceof Error ? error.message : "unknown error",
      });
    } finally {
      setRunningLiveTest(false);
    }
  }

  return (
    <section id="playground" className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#1b5a65]">interactive</p>
          <h2 className="mt-2 text-2xl font-semibold md:text-3xl">Policy Playground</h2>
        </div>
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
                onClick={() => setInput(preset)}
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
              {copied ? "copiado" : "copiar"}
            </button>
          </div>
          <pre className="min-h-24 whitespace-pre-wrap border border-[#1b5a65]/15 bg-[#f7fbfa] p-3 text-sm leading-relaxed text-ink" style={{ borderRadius: "6px" }}>
            {result.sanitized || "(sin contenido)"}
          </pre>
        </article>
      </div>

      <article className="mt-6 border border-[#1b5a65]/25 bg-[#f7fbfa] p-5" style={{ borderRadius: "6px" }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-graphite">live interceptor test</p>
          <button
            type="button"
            onClick={runLiveTest}
            disabled={runningLiveTest || input.trim().length === 0}
            className="border border-[#1b5a65]/25 bg-[#1b5a65] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#144a53] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderRadius: "6px" }}
          >
            {runningLiveTest ? "ejecutando..." : "test real"}
          </button>
        </div>

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
            </div>

            {liveResult.traceId ? (
              <p className="text-xs text-graphite-dark">trace: {liveResult.traceId}</p>
            ) : null}
            {liveResult.target ? (
              <p className="text-xs text-graphite-dark">target: {liveResult.target}</p>
            ) : null}
            {liveResult.hint ? <p className="text-sm text-[#8a5f1f]">{liveResult.hint}</p> : null}
            {liveResult.error ? <p className="text-sm text-[#8a2d2d]">{liveResult.error}: {liveResult.detail}</p> : null}

            {liveResult.arkiv?.promptReviewKey ? (
              <div className="space-y-2 border border-[#1b5a65]/15 bg-white p-3 text-xs text-graphite-dark" style={{ borderRadius: "6px" }}>
                <p className="font-mono uppercase tracking-[0.12em] text-graphite">arkiv persisted</p>
                <p>policy: {liveResult.arkiv.policyKey}</p>
                <p>prompt_review: {liveResult.arkiv.promptReviewKey}</p>
                <p>policy_decision: {liveResult.arkiv.policyDecisionKey}</p>
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
