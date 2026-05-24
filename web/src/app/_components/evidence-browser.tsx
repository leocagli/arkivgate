"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type EvidenceEntity = {
  key: string;
  owner: string | null;
  creator: string | null;
  contentType: string | null;
  expiresAtBlock: string | null;
  createdAtBlock: string | null;
  attributes: Array<{ key: string; value: string | number }>;
  payload: unknown;
  explorer: string;
  links: {
    agentEntityKey?: string;
    paymentReviewKey?: string;
    promptReviewKey?: string;
    policyKey?: string;
  };
};

type EvidenceResponse = {
  ok: boolean;
  project?: string;
  count?: number;
  hasNextPage?: boolean;
  cursor?: string | null;
  explorerQuery?: string;
  retention?: Record<string, number>;
  entities?: EvidenceEntity[];
  error?: string;
  detail?: string;
};

const ENTITY_TYPES = [
  "policy_decision",
  "prompt_review",
  "payment_review",
  "agent",
  "policy",
  "all",
] as const;

const ACTIONS = ["", "BLOCK", "REDACT", "WARN", "LOG", "PASS"] as const;
const SEVERITIES = ["", "critical", "high", "medium", "low"] as const;

function attr(entity: EvidenceEntity, key: string): string {
  const value = entity.attributes.find((item) => item.key === key)?.value;
  return value === undefined ? "" : String(value);
}

function short(value: string | null | undefined, chars = 10): string {
  if (!value) return "-";
  if (value.length <= chars * 2 + 3) return value;
  return `${value.slice(0, chars)}...${value.slice(-chars)}`;
}

function dateLabel(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(numeric));
}

function payloadReason(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const record = payload as Record<string, unknown>;
  if (typeof record.reason === "string") return record.reason;
  if (typeof record.explanation === "string") return record.explanation;
  if (typeof record.promptRedacted === "string") return record.promptRedacted;
  return "";
}

export function EvidenceBrowser() {
  const [entityType, setEntityType] = useState<(typeof ENTITY_TYPES)[number]>("policy_decision");
  const [action, setAction] = useState("");
  const [severity, setSeverity] = useState("");
  const [agentKey, setAgentKey] = useState("");
  const [minRiskScore, setMinRiskScore] = useState("");
  const [windowHours, setWindowHours] = useState("168");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvidenceResponse | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selected = useMemo(
    () => result?.entities?.find((entity) => entity.key === selectedKey) ?? result?.entities?.[0] ?? null,
    [result?.entities, selectedKey],
  );

  async function runQuery() {
    setLoading(true);
    const params = new URLSearchParams({
      entityType,
      limit: "12",
    });
    if (action) params.set("action", action);
    if (severity) params.set("severity", severity);
    if (agentKey.trim()) params.set("agentKey", agentKey.trim());
    if (minRiskScore.trim()) params.set("minRiskScore", minRiskScore.trim());
    if (windowHours.trim()) {
      const hours = Number(windowHours);
      if (Number.isFinite(hours) && hours > 0) {
        params.set("createdAfter", String(Date.now() - hours * 60 * 60 * 1000));
      }
    }

    try {
      const response = await fetch(`/api/arkiv/evidence?${params.toString()}`, {
        cache: "no-store",
      });
      const json = (await response.json().catch(() => null)) as EvidenceResponse | null;
      setResult(json ?? { ok: false, error: "invalid evidence response" });
      setSelectedKey(json?.entities?.[0]?.key ?? null);
    } catch (error) {
      setResult({
        ok: false,
        error: "evidence query failed",
        detail: error instanceof Error ? error.message : "unknown error",
      });
      setSelectedKey(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void runQuery();
    }, 0);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section id="evidence" className="border-y border-[#174a53]/15 bg-[#eff6f5]">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-16 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#1b5a65]">
              arkiv evidence browser
            </p>
            <h2 className="mt-2 text-2xl font-semibold md:text-3xl">
              Evidencia consultable, no logs privados.
            </h2>
          </div>
          <a
            href={result?.explorerQuery ?? "https://data.arkiv.network"}
            target="_blank"
            rel="noreferrer"
            className="border border-[#1b5a65]/30 bg-white px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[#1b5a65] transition-colors hover:bg-[#e1edeb]"
            style={{ borderRadius: "6px" }}
          >
            abrir query
          </a>
        </div>

        <div className="grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-3 border border-[#1b5a65]/20 bg-white p-4" style={{ borderRadius: "6px" }}>
            <div className="grid gap-3 md:grid-cols-3">
              <FilterSelect label="entity" value={entityType} onChange={(value) => setEntityType(value as (typeof ENTITY_TYPES)[number])}>
                {ENTITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect label="action" value={action} onChange={setAction}>
                {ACTIONS.map((item) => (
                  <option key={item || "any-action"} value={item}>
                    {item || "any"}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect label="severity" value={severity} onChange={setSeverity}>
                {SEVERITIES.map((item) => (
                  <option key={item || "any-severity"} value={item}>
                    {item || "any"}
                  </option>
                ))}
              </FilterSelect>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <FilterInput label="agentKey" value={agentKey} onChange={setAgentKey} placeholder="agent_..." />
              <FilterInput label="risk >=" value={minRiskScore} onChange={setMinRiskScore} placeholder="60" />
              <FilterInput label="hours" value={windowHours} onChange={setWindowHours} placeholder="168" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void runQuery()}
                disabled={loading}
                className="border border-[#1b5a65]/25 bg-[#1b5a65] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#144a53] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ borderRadius: "6px" }}
              >
                {loading ? "querying..." : "run arkiv query"}
              </button>
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-graphite">
                project={result?.project ?? "arkivgate-leocagli-2026"}
              </span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <EvidenceMetric label="entities" value={String(result?.count ?? 0)} />
            <EvidenceMetric label="pagination" value={result?.hasNextPage ? "next" : "end"} />
            <EvidenceMetric label="retention" value={retentionLabel(result?.retention)} />
          </div>
        </div>

        {result?.error ? (
          <div className="border border-[#8a2d2d]/25 bg-[#f8e7e7] p-4 text-sm text-[#8a2d2d]" style={{ borderRadius: "6px" }}>
            {result.error}
            {result.detail ? `: ${result.detail}` : null}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="min-h-[360px] border border-[#1b5a65]/20 bg-white" style={{ borderRadius: "6px" }}>
            <div className="border-b border-[#1b5a65]/15 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-graphite">
              query results
            </div>
            <ul className="max-h-[480px] overflow-auto divide-y divide-[#1b5a65]/10">
              {(result?.entities ?? []).map((entity) => {
                const isSelected = selected?.key === entity.key;
                return (
                  <li key={entity.key}>
                    <button
                      type="button"
                      onClick={() => setSelectedKey(entity.key)}
                      className={`block w-full px-4 py-3 text-left transition-colors ${
                        isSelected ? "bg-[#e4f4ef]" : "bg-white hover:bg-[#f7fbfa]"
                      }`}
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] uppercase tracking-[0.13em] text-[#1b5a65]">
                          {attr(entity, "entityType") || "entity"}
                        </span>
                        <span
                          className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${actionTone(attr(entity, "action"))}`}
                          style={{ borderRadius: "6px" }}
                        >
                          {attr(entity, "action") || "n/a"}
                        </span>
                        {attr(entity, "severity") ? (
                          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-graphite">
                            {attr(entity, "severity")}
                          </span>
                        ) : null}
                      </div>
                      <p className="break-all font-mono text-xs text-ink">{short(entity.key, 12)}</p>
                      <p className="mt-1 text-xs text-graphite-dark">
                        risk {attr(entity, "riskScore") || "0"} / {dateLabel(attr(entity, "createdAt"))}
                      </p>
                    </button>
                  </li>
                );
              })}
              {result?.ok && result.entities?.length === 0 ? (
                <li className="px-4 py-8 text-sm text-graphite-dark">No evidence matched the current filters.</li>
              ) : null}
            </ul>
          </div>

          <EvidenceDetails entity={selected} retention={result?.retention ?? {}} />
        </div>
      </div>
    </section>
  );
}

function EvidenceDetails({
  entity,
  retention,
}: {
  entity: EvidenceEntity | null;
  retention: Record<string, number>;
}) {
  if (!entity) {
    return (
      <div className="border border-[#1b5a65]/20 bg-white p-5 text-sm text-graphite-dark" style={{ borderRadius: "6px" }}>
        Select an evidence entity.
      </div>
    );
  }

  const entityType = attr(entity, "entityType");
  const reason = payloadReason(entity.payload);

  return (
    <div className="border border-[#1b5a65]/20 bg-white" style={{ borderRadius: "6px" }}>
      <div className="border-b border-[#1b5a65]/15 px-4 py-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-graphite">selected evidence</p>
        <a
          href={entity.explorer}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block break-all font-mono text-xs text-[#1b5a65] underline underline-offset-4"
        >
          {entity.key}
        </a>
      </div>

      <div className="grid gap-4 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <EvidenceMetric label="type" value={entityType || "-"} />
          <EvidenceMetric label="risk" value={attr(entity, "riskScore") || "0"} />
          <EvidenceMetric label="retention" value={retention[entityType] ? `${retention[entityType]}d` : "-"} />
        </div>

        <div className="grid gap-2 border border-[#1b5a65]/15 bg-[#f7fbfa] p-3" style={{ borderRadius: "6px" }}>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite">relationship tree</p>
          <TreeLine label="agent" value={entity.links.agentEntityKey ?? (entityType === "agent" ? entity.key : undefined)} />
          <TreeLine label="payment_review" value={entity.links.paymentReviewKey} />
          <TreeLine label="prompt_review" value={entity.links.promptReviewKey ?? (entityType === "prompt_review" ? entity.key : undefined)} />
          <TreeLine label="policy_decision" value={entityType === "policy_decision" ? entity.key : undefined} />
          <TreeLine label="policy" value={entity.links.policyKey ?? (entityType === "policy" ? entity.key : undefined)} />
        </div>

        <div className="grid gap-2 text-sm text-ink">
          <MetaLine label="owner" value={entity.owner} />
          <MetaLine label="creator" value={entity.creator} />
          <MetaLine label="createdAt" value={dateLabel(attr(entity, "createdAt"))} />
          <MetaLine label="expiresAtBlock" value={entity.expiresAtBlock} />
        </div>

        {reason ? (
          <div className="border border-[#1b5a65]/15 bg-[#f7fbfa] p-3 text-sm leading-relaxed text-ink" style={{ borderRadius: "6px" }}>
            {reason}
          </div>
        ) : null}

        <pre className="max-h-56 overflow-auto border border-[#1b5a65]/15 bg-[#0f3138] p-3 text-xs leading-relaxed text-[#d9ece8]" style={{ borderRadius: "6px" }}>
          {JSON.stringify(entity.payload ?? {}, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs text-graphite-dark">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-[38px] w-full border border-[#1b5a65]/25 bg-[#f7fbfa] px-2 text-sm text-ink outline-none focus:border-[#1b5a65]"
        style={{ borderRadius: "6px" }}
      >
        {children}
      </select>
    </label>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block text-xs text-graphite-dark">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1.5 h-[38px] w-full border border-[#1b5a65]/25 bg-[#f7fbfa] px-2 text-sm text-ink outline-none focus:border-[#1b5a65]"
        style={{ borderRadius: "6px" }}
      />
    </label>
  );
}

function EvidenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#1b5a65]/20 bg-white p-3" style={{ borderRadius: "6px" }}>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite">{label}</p>
      <p className="mt-1 break-all text-sm font-semibold text-[#123c45]">{value}</p>
    </div>
  );
}

function TreeLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 text-xs">
      <span className="font-mono uppercase tracking-[0.12em] text-graphite">{label}</span>
      <span className="break-all font-mono text-ink">{value ? short(value, 12) : "-"}</span>
    </div>
  );
}

function MetaLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid gap-1 border-b border-[#1b5a65]/10 pb-2 md:grid-cols-[120px_1fr]">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-graphite">{label}</span>
      <span className="break-all text-xs text-ink">{value ?? "-"}</span>
    </div>
  );
}

function retentionLabel(retention?: Record<string, number>): string {
  const entries = Object.entries(retention ?? {});
  if (entries.length === 0) return "-";
  const [type, days] = entries[0];
  return `${type}:${days}d`;
}

function actionTone(action: string) {
  if (action === "BLOCK") return "border-[#8a2d2d] bg-[#f8e7e7] text-[#8a2d2d]";
  if (action === "REDACT") return "border-[#8a5f1f] bg-[#fff4e3] text-[#8a5f1f]";
  if (action === "WARN") return "border-[#385f88] bg-[#e8f2ff] text-[#385f88]";
  return "border-[#2e6659] bg-[#e4f4ef] text-[#2e6659]";
}
