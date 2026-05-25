"use client";
/* eslint-disable react/jsx-no-comment-textnodes */

import { useMemo, useState, useTransition } from "react";
import { ConfirmDialog, Toast, type ConfirmConfig, type ToastState } from "@/components/feedback";
import type { RuntimeApiKeyDTO } from "@/lib/api-keys-server";

type CreateResult = {
  key: RuntimeApiKeyDTO;
  secret: string;
};

export function ApiKeysPanel({
  initialKeys,
  interceptorBaseUrl,
}: {
  initialKeys: RuntimeApiKeyDTO[];
  interceptorBaseUrl: string;
}) {
  const [keys, setKeys] = useState(initialKeys);
  const [label, setLabel] = useState("");
  const [created, setCreated] = useState<CreateResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<RuntimeApiKeyDTO | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [, startTransition] = useTransition();

  const normalizedBase = interceptorBaseUrl.replace(/\/+$/, "");
  const secret = created?.secret ?? "tk_REEMPLAZAR_CON_SECRET";
  const baseUrl = `${normalizedBase}/cli/${secret}`;

  const snippets = useMemo(
    () => ({
      env: `ANTHROPIC_BASE_URL=${baseUrl}`,
      curl: [
        `curl ${baseUrl}/v1/messages \\`,
        `  -H "content-type: application/json" \\`,
        `  -H "x-api-key: $ANTHROPIC_API_KEY" \\`,
        `  -d '{"model":"claude-3-5-sonnet-latest","max_tokens":64,"messages":[{"role":"user","content":"ping"}]}'`,
      ].join("\n"),
      validate: [
        `curl ${windowOrigin()}/api/cli/me \\`,
        `  -H "authorization: Bearer ${secret}"`,
      ].join("\n"),
    }),
    [baseUrl, secret],
  );

  async function refresh() {
    const res = await fetch("/api/admin/api-keys", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { keys: RuntimeApiKeyDTO[] };
    startTransition(() => setKeys(data.keys));
  }

  async function createKey(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setCreated(null);
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: label.trim() || undefined }),
      });
      const data = (await res.json()) as CreateResult | { error?: string };
      if (!res.ok || !("secret" in data)) {
        const message = "error" in data ? data.error : null;
        setToast({ kind: "error", message: message ?? "no pude crear la API key" });
        return;
      }
      setCreated(data);
      setLabel("");
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ kind: "success", message: "copiado al portapapeles" });
    } catch {
      setToast({ kind: "error", message: `No pude copiar. Selecciona manualmente: ${value}` });
    }
  }

  async function confirmRevoke() {
    const key = pendingRevoke;
    setPendingRevoke(null);
    if (!key) return;
    const res = await fetch(`/api/admin/api-keys/${key.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setToast({ kind: "error", message: data?.error ?? "no pude revocar la key" });
      return;
    }
    setToast({ kind: "success", message: "API key revocada" });
    await refresh();
  }

  const revokeConfig: ConfirmConfig | null = pendingRevoke
    ? {
        title: `Revocar ${pendingRevoke.label ?? "API key"}?`,
        body: "El cliente que use este secret deja de poder pasar por el interceptor. La evidencia historica se mantiene.",
        confirmLabel: "Revocar",
        cancelLabel: "Cancelar",
        destructive: true,
      }
    : null;

  return (
    <div className="flex flex-col gap-8">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <ConfirmDialog
        open={pendingRevoke !== null}
        config={revokeConfig}
        onConfirm={confirmRevoke}
        onCancel={() => setPendingRevoke(null)}
      />

      <form
        onSubmit={createKey}
        className="flex flex-col gap-4 border border-graphite-dark/20 bg-paper p-6"
        style={{ borderRadius: "var(--radius)" }}
      >
        <span className="font-mono text-xs uppercase tracking-wider text-graphite">
          // nueva runtime key
        </span>
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="cliente demo / dapp / wallet agent"
            className="flex-1 border border-graphite-dark/30 bg-paper px-3 py-2 font-mono text-sm focus:border-ink focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center bg-ink px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-paper transition-colors hover:bg-graphite-dark disabled:opacity-60"
            style={{ borderRadius: "var(--radius)" }}
          >
            {submitting ? "generando..." : "generar secret"}
          </button>
        </div>
        <p className="font-mono text-[11px] leading-relaxed text-graphite">
          // este secret identifica a la org y permite que el sitio cliente use
          ArkivGate como gateway de prompts, pagos x402 y wallets.
        </p>
      </form>

      {created && (
        <div
          className="flex flex-col gap-4 border border-ink/30 bg-ink/[0.04] p-6"
          style={{ borderRadius: "var(--radius)" }}
        >
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-graphite">
              // secret generado
            </span>
            <p className="mt-2 text-sm leading-relaxed text-graphite-dark">
              Guardalo ahora. Despues solo vas a poder revocarlo y crear otro.
            </p>
          </div>
          <CopyBlock label="secret" value={created.secret} onCopy={copy} strong />
          <CopyBlock label="base url compatible Anthropic" value={baseUrl} onCopy={copy} />
          <CopyBlock label="env para el cliente" value={snippets.env} onCopy={copy} />
        </div>
      )}

      <div
        className="grid gap-4 border border-graphite-dark/20 bg-paper-soft/30 p-6 md:grid-cols-3"
        style={{ borderRadius: "var(--radius)" }}
      >
        <IntegrationCard
          title="1. crear secret"
          body="Generas una runtime key por cliente, demo o agente. No se vuelve a mostrar."
        />
        <IntegrationCard
          title="2. configurar cliente"
          body="El cliente usa la base URL /cli/<secret> para que todo request pase por ArkivGate."
        />
        <IntegrationCard
          title="3. auditar en admin"
          body="Events, analytics y Arkiv muestran que decision se tomo y por que."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CopyBlock label="curl demo" value={snippets.curl} onCopy={copy} multiline />
        <CopyBlock label="validar secret" value={snippets.validate} onCopy={copy} multiline />
      </div>

      <div className="flex flex-col gap-3">
        <span className="font-mono text-xs uppercase tracking-wider text-graphite">
          // keys emitidas
        </span>
        <div
          className="overflow-hidden border border-graphite-dark/20"
          style={{ borderRadius: "var(--radius)" }}
        >
          {keys.length === 0 ? (
            <div className="p-5 text-sm text-graphite-dark">
              Todavia no hay API keys para esta org.
            </div>
          ) : (
            <ul>
              {keys.map((key, index) => (
                <li
                  key={key.id}
                  className={`grid gap-3 px-4 py-3 md:grid-cols-[1fr_auto] ${
                    index > 0 ? "border-t border-graphite-dark/15" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono text-sm text-ink">
                        {key.label ?? "runtime key"}
                      </span>
                      <span className="font-mono text-[11px] uppercase tracking-wider text-graphite">
                        // {key.revokedAt ? "revocada" : "activa"}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] leading-relaxed text-graphite">
                      owner {key.ownerEmail} · creada {formatDate(key.createdAt)}
                      {key.lastUsedAt ? ` · ultimo uso ${formatDate(key.lastUsedAt)}` : ""}
                    </p>
                  </div>
                  {!key.revokedAt ? (
                    <button
                      type="button"
                      onClick={() => setPendingRevoke(key)}
                      className="justify-self-start font-mono text-[11px] uppercase tracking-wider text-graphite transition-colors hover:font-semibold hover:text-ink md:justify-self-end"
                    >
                      revocar
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function CopyBlock({
  label,
  value,
  onCopy,
  multiline = false,
  strong = false,
}: {
  label: string;
  value: string;
  onCopy: (value: string) => void;
  multiline?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-2 border border-graphite-dark/20 bg-paper p-4"
      style={{ borderRadius: "var(--radius)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-graphite">
          // {label}
        </span>
        <button
          type="button"
          onClick={() => onCopy(value)}
          className="font-mono text-[11px] uppercase tracking-wider text-graphite hover:text-ink"
        >
          copiar
        </button>
      </div>
      <code
        className={`block overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-relaxed ${
          strong ? "font-semibold text-ink" : "text-graphite-dark"
        } ${multiline ? "min-h-28" : ""}`}
      >
        {value}
      </code>
    </div>
  );
}

function IntegrationCard({ title, body }: { title: string; body: string }) {
  return (
    <article>
      <h2 className="font-mono text-xs uppercase tracking-wider text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-graphite-dark">{body}</p>
    </article>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function windowOrigin(): string {
  if (typeof window === "undefined") return "https://arkivgate.vercel.app";
  return window.location.origin;
}
