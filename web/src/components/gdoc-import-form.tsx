"use client";
/* eslint-disable react/jsx-no-comment-textnodes */

import { useState } from "react";
import Link from "next/link";

type Suggestion = {
  id: string;
  proposedSlug: string;
  proposedAction: string;
  proposedSeverity: string;
};

type ImportResult = {
  imported: number;
  truncated: boolean;
  suggestions: Suggestion[];
};

export function GdocImportForm() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gdoc/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ docUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unknown error");
      } else {
        setResult(data);
        setUrl("");
      }
    } catch {
      setError("Could not connect to the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-graphite-dark">
        Paste the URL of a public Google Doc with your company's security
        policies. ArkivGate extracts rules and sends them to the{" "}
        <Link href="/admin/suggestions" className="underline hover:text-ink">
          suggestions
        </Link>{" "}
        queue for review.
      </p>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          placeholder="https://docs.google.com/document/d/..."
          className="flex-1 border border-graphite-dark/30 bg-paper px-3 py-2 font-mono text-sm focus:border-ink focus:outline-none"
          style={{ borderRadius: "var(--radius)" }}
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center bg-ink px-4 py-2 font-mono text-xs uppercase tracking-wider text-paper transition-colors hover:bg-graphite-dark disabled:opacity-60"
          style={{ borderRadius: "var(--radius)" }}
        >
          {loading ? "// extracting..." : "import doc"}
        </button>
      </form>

      {error && (
        <p className="inline-flex items-center gap-2 font-mono text-xs font-semibold text-ink">
          <span aria-hidden className="h-3 w-1 bg-ink" />
          // error / {error}
        </p>
      )}

      {result && (
        <div
          className="border border-graphite-dark/20 bg-paper-soft/30 p-4"
          style={{ borderRadius: "var(--radius)" }}
        >
          <p className="mb-2 font-mono text-xs text-graphite">
            // {result.imported} polic{result.imported !== 1 ? "ies" : "y"} sent to the queue
            {result.truncated ? " / document truncated to 30,000 characters" : ""}
          </p>
          <ul className="mb-3 flex flex-col gap-1">
            {result.suggestions.map((s) => (
              <li key={s.id} className="flex gap-3 font-mono text-xs text-graphite-dark">
                <span className="text-ink">{s.proposedSlug}</span>
                <span>/</span>
                <span>{s.proposedAction}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/admin/suggestions"
            className="font-mono text-xs uppercase tracking-wider text-graphite underline-offset-2 hover:text-ink hover:underline"
          >
            // review in suggestions -&gt;
          </Link>
        </div>
      )}
    </div>
  );
}
