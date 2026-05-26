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
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<RuntimeApiKeyDTO | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [, startTransition] = useTransition();

  const normalizedBase = interceptorBaseUrl.replace(/\/+$/, "");
  const secret = created?.secret ?? "tk_REPLACE_WITH_SECRET";
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
    const res = await fetch("/api/admin/api-keys", { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return;
    const data = (await res.json()) as { keys: RuntimeApiKeyDTO[] };
    startTransition(() => setKeys(data.keys));
  }

  async function createKey(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setCreated(null);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ label: label.trim() || undefined }),
      });
      const data = (await res.json().catch(() => null)) as
        | CreateResult
        | { error?: string; detail?: string }
        | null;
      if (!res.ok || !data || !("secret" in data)) {
        const message = data && "error" in data ? [data.error, data.detail].filter(Boolean).join(": ") : null;
        setFormError(message ?? "could not create the API key");
        setToast({ kind: "error", message: message ?? "could not create the API key" });
        return;
      }
      setCreated(data);
      setKeys((prev) => [data.key, ...prev.filter((key) => key.id !== data.key.id)]);
      setLabel("");
      await refresh();
      setToast({ kind: "success", message: "API key generated" });
    } finally {
      setSubmitting(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ kind: "success", message: "copied to clipboard" });
    } catch {
      setToast({ kind: "error", message: `Could not copy. Select manually: ${value}` });
    }
  }

  async function confirmRevoke() {
    const key = pendingRevoke;
    setPendingRevoke(null);
    if (!key) return;
    const res = await fetch(`/api/admin/api-keys/${key.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setToast({ kind: "error", message: data?.error ?? "could not revoke the key" });
      return;
    }
    setToast({ kind: "success", message: "API key revoked" });
    await refresh();
  }

  const revokeConfig: ConfirmConfig | null = pendingRevoke
    ? {
        title: `Revoke ${pendingRevoke.label ?? "API key"}?`,
        body: "Any client using this secret will stop passing through the interceptor. Historical evidence remains intact.",
        confirmLabel: "Revoke",
        cancelLabel: "Cancel",
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
          // new runtime key
        </span>
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="demo client / dapp / wallet agent"
            className="flex-1 border border-graphite-dark/30 bg-paper px-3 py-2 font-mono text-sm focus:border-ink focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center bg-ink px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-paper transition-colors hover:bg-graphite-dark disabled:opacity-60"
            style={{ borderRadius: "var(--radius)" }}
          >
            {submitting ? "generating..." : "generate secret"}
          </button>
        </div>
        <p className="font-mono text-[11px] leading-relaxed text-graphite">
          // this secret identifies the org and lets the client use ArkivGate
          as the gateway for prompts, x402 payments, and wallets.
        </p>
        {formError ? (
          <p className="border border-red-900/20 bg-red-50 px-3 py-2 text-sm text-red-900" style={{ borderRadius: "var(--radius)" }}>
            {formError}
          </p>
        ) : null}
      </form>

      {created && (
        <div
          className="flex flex-col gap-4 border border-ink/30 bg-ink/[0.04] p-6"
          style={{ borderRadius: "var(--radius)" }}
        >
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-graphite">
              // generated secret
            </span>
            <p className="mt-2 text-sm leading-relaxed text-graphite-dark">
              Store it now. Later you can only revoke it and create another one.
            </p>
          </div>
          <CopyBlock label="secret" value={created.secret} onCopy={copy} strong />
          <CopyBlock label="Anthropic-compatible base URL" value={baseUrl} onCopy={copy} />
          <CopyBlock label="client env" value={snippets.env} onCopy={copy} />
        </div>
      )}

      <div
        className="grid gap-4 border border-graphite-dark/20 bg-paper-soft/30 p-6 md:grid-cols-3"
        style={{ borderRadius: "var(--radius)" }}
      >
        <IntegrationCard
          title="1. create secret"
          body="Generate one runtime key per customer, demo, or agent. It is never shown again."
        />
        <IntegrationCard
          title="2. configure client"
          body="The client uses the /cli/<secret> base URL so every request goes through ArkivGate."
        />
        <IntegrationCard
          title="3. audit in admin"
          body="Events, analytics, and Arkiv show what decision was made and why."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CopyBlock label="curl demo" value={snippets.curl} onCopy={copy} multiline />
        <CopyBlock label="validate secret" value={snippets.validate} onCopy={copy} multiline />
      </div>

      <div className="flex flex-col gap-3">
        <span className="font-mono text-xs uppercase tracking-wider text-graphite">
          // issued keys
        </span>
        <div
          className="overflow-hidden border border-graphite-dark/20"
          style={{ borderRadius: "var(--radius)" }}
        >
          {keys.length === 0 ? (
            <div className="p-5 text-sm text-graphite-dark">
              No API keys have been issued for this org yet.
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
                        // {key.revokedAt ? "revoked" : "active"}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] leading-relaxed text-graphite">
                      owner {key.ownerEmail} · created {formatDate(key.createdAt)}
                      {key.lastUsedAt ? ` · last used ${formatDate(key.lastUsedAt)}` : ""}
                    </p>
                  </div>
                  {!key.revokedAt ? (
                    <button
                      type="button"
                      onClick={() => setPendingRevoke(key)}
                      className="justify-self-start font-mono text-[11px] uppercase tracking-wider text-graphite transition-colors hover:font-semibold hover:text-ink md:justify-self-end"
                    >
                      revoke
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
          copy
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
  return new Intl.DateTimeFormat("en-US", {
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
