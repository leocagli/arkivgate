"use client";
/* eslint-disable react/jsx-no-comment-textnodes */

import { useMemo, useState } from "react";

import { Button, Field, Pane, fieldInputClass } from "@/components/ui";

type EntityType = "policy" | "prompt_review" | "policy_decision";

type SmokeResponse = {
  ok: boolean;
  action: "BLOCK" | "REDACT" | "WARN" | "LOG";
  riskScore: number;
  entities: {
    policy: { key: string; explorer: string };
    promptReview: { key: string; explorer: string };
    policyDecision: { key: string; explorer: string };
  };
  queries: {
    policy: string;
    promptReview: string;
    policyDecision: string;
  };
  error?: string;
};

type QueryResponse = {
  ok: boolean;
  entityType: EntityType;
  count: number;
  explorerQuery: string;
  entities: Array<{
    key: string | null;
    owner: string | null;
    attributes: Array<{ key: string; value: string | number }>;
    payload: unknown;
  }>;
  error?: string;
};

export function ArkivPanel() {
  const [smokePrompt, setSmokePrompt] = useState(
    "Help me deploy this quickly. Here is my key: AKIA1234567890ABCDEF",
  );
  const [smokeLoading, setSmokeLoading] = useState(false);
  const [smokeResult, setSmokeResult] = useState<SmokeResponse | null>(null);
  const [smokeError, setSmokeError] = useState<string | null>(null);

  const [entityType, setEntityType] = useState<EntityType>("prompt_review");
  const [limit, setLimit] = useState("15");
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  const parsedLimit = useMemo(() => {
    const n = Number(limit);
    if (!Number.isFinite(n)) return 15;
    return Math.max(1, Math.min(100, Math.trunc(n)));
  }, [limit]);

  async function runSmoke() {
    setSmokeLoading(true);
    setSmokeError(null);
    try {
      const res = await fetch("/api/admin/arkiv/smoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: smokePrompt }),
      });
      const json = (await res.json().catch(() => null)) as SmokeResponse | null;
      if (!res.ok || !json?.ok) {
        setSmokeError(json?.error ?? "no se pudo ejecutar el smoke de arkiv");
        setSmokeResult(null);
        return;
      }
      setSmokeResult(json);
    } catch {
      setSmokeError("error de red al ejecutar smoke");
      setSmokeResult(null);
    } finally {
      setSmokeLoading(false);
    }
  }

  async function runQuery() {
    setQueryLoading(true);
    setQueryError(null);
    try {
      const params = new URLSearchParams({
        entityType,
        limit: String(parsedLimit),
      });
      const res = await fetch(`/api/admin/arkiv/query?${params.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as QueryResponse | null;
      if (!res.ok || !json?.ok) {
        setQueryError(json?.error ?? "fallo al consultar arkiv");
        setQueryResult(null);
        return;
      }
      setQueryResult(json);
    } catch {
      setQueryError("error de red al consultar arkiv");
      setQueryResult(null);
    } finally {
      setQueryLoading(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Pane caption="arkiv smoke" padding="lg">
        <h2 className="text-xl font-semibold tracking-tight">Probar escritura end-to-end</h2>
        <p className="text-sm leading-relaxed text-graphite-dark">
          Ejecuta el flujo completo policy → prompt review → decision y devuelve los keys
          creados para validar que backend y Arkiv estan conectados.
        </p>

        <Field
          label="prompt de prueba"
          htmlFor="arkiv-smoke-prompt"
          hint="usa un prompt con credenciales para probar BLOCK/REDACT"
          full
        >
          {({ id }) => (
            <textarea
              id={id}
              rows={4}
              value={smokePrompt}
              onChange={(e) => setSmokePrompt(e.target.value)}
              className={`${fieldInputClass} min-h-[120px] resize-y`}
            />
          )}
        </Field>

        <div className="flex items-center gap-3">
          <Button onClick={runSmoke} disabled={smokeLoading} size="sm">
            {smokeLoading ? "ejecutando..." : "run smoke"}
          </Button>
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-graphite">
            // crea 3 entidades
          </span>
        </div>

        {smokeError ? (
          <p className="font-mono text-xs text-red-700">// error · {smokeError}</p>
        ) : null}

        {smokeResult ? (
          <div className="grid gap-3 border border-graphite-dark/20 p-4" style={{ borderRadius: "var(--radius)" }}>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs uppercase tracking-[0.22em] text-graphite">
                // action
              </span>
              <span className="font-mono text-xs text-ink">
                {smokeResult.action} · risk {smokeResult.riskScore}
              </span>
            </div>

            <ArkivLinkLine label="policy" href={smokeResult.entities.policy.explorer} value={smokeResult.entities.policy.key} />
            <ArkivLinkLine
              label="prompt_review"
              href={smokeResult.entities.promptReview.explorer}
              value={smokeResult.entities.promptReview.key}
            />
            <ArkivLinkLine
              label="policy_decision"
              href={smokeResult.entities.policyDecision.explorer}
              value={smokeResult.entities.policyDecision.key}
            />
          </div>
        ) : null}
      </Pane>

      <Pane caption="arkiv query" padding="lg">
        <h2 className="text-xl font-semibold tracking-tight">Explorar entidades</h2>
        <p className="text-sm leading-relaxed text-graphite-dark">
          Consulta por tipo de entidad para auditar evidencia registrada desde el
          interceptor y el admin.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="entity type" htmlFor="arkiv-entity-type">
            {({ id }) => (
              <select
                id={id}
                value={entityType}
                onChange={(e) => setEntityType(e.target.value as EntityType)}
                className={fieldInputClass}
              >
                <option value="prompt_review">prompt_review</option>
                <option value="policy_decision">policy_decision</option>
                <option value="policy">policy</option>
              </select>
            )}
          </Field>
          <Field label="limit" htmlFor="arkiv-limit">
            {({ id }) => (
              <input
                id={id}
                type="number"
                min={1}
                max={100}
                step={1}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className={fieldInputClass}
              />
            )}
          </Field>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={runQuery} disabled={queryLoading} size="sm">
            {queryLoading ? "consultando..." : "run query"}
          </Button>
          {queryResult?.explorerQuery ? (
            <a
              href={queryResult.explorerQuery}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink underline underline-offset-4"
            >
              abrir en explorer →
            </a>
          ) : null}
        </div>

        {queryError ? <p className="font-mono text-xs text-red-700">// error · {queryError}</p> : null}

        {queryResult ? (
          <div className="border border-graphite-dark/20" style={{ borderRadius: "var(--radius)" }}>
            <div className="border-b border-graphite-dark/20 bg-paper-soft/40 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-graphite">
              // {queryResult.count} resultados
            </div>
            <ul className="max-h-[420px] overflow-auto divide-y divide-graphite-dark/10">
              {queryResult.entities.map((entity, idx) => (
                <li key={entity.key ?? `entity-${idx}`} className="space-y-1.5 px-4 py-3">
                  <p className="font-mono text-xs text-ink break-all">{entity.key ?? "(sin key)"}</p>
                  <p className="font-mono text-[11px] text-graphite break-all">
                    owner: {entity.owner ?? "-"}
                  </p>
                  <p className="font-mono text-[11px] text-graphite break-all">
                    attrs: {entity.attributes.map((a) => `${a.key}=${String(a.value)}`).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Pane>
    </div>
  );
}

function ArkivLinkLine({ label, href, value }: { label: string; href: string; value: string }) {
  return (
    <div className="grid gap-1.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-graphite">
        // {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-ink break-all">{value}</span>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink underline underline-offset-4"
        >
          explorer →
        </a>
      </div>
    </div>
  );
}
