// /admin/suggestions — cola de aprobación del AI Suggestor y de imports gdoc.
/* eslint-disable react/jsx-no-comment-textnodes */
import { getAdminSession } from "@/lib/admin-session";
import {
  listCurrentRulesBySlugs,
  listSuggestions,
  sortSuggestionsForReview,
} from "@/lib/suggestions-server";
import {
  SuggestionsPanel,
} from "./_components/suggestions-panel";

export const dynamic = "force-dynamic";

export default async function SuggestionsPage() {
  const session = await getAdminSession();
  if (!session) return null;

  const rows = await listSuggestions(session.orgId);

  // Pull the current state of every policy whose slug matches an incoming
  // suggestion. The diff view in the panel needs both sides.
  const proposedSlugs = Array.from(new Set(rows.map((r) => r.proposedSlug)));
  const currentBySlug = await listCurrentRulesBySlugs(session.orgId, proposedSlugs);

  return (
    <section>
      <header className="mb-8 flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-wider text-graphite">
          // sugerencias
        </span>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Cola de aprobación.
        </h1>
        <p className="max-w-2xl text-graphite-dark">
          Reglas propuestas por el AI Suggestor o importadas desde Google Docs.
          Aceptar las convierte en políticas activas; el proxy las aplica al
          próximo request.
        </p>
      </header>
      <SuggestionsPanel
        initialSuggestions={sortSuggestionsForReview(rows)}
        currentBySlug={currentBySlug}
      />
    </section>
  );
}
