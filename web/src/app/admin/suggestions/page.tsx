// /admin/suggestions - approval queue for AI Suggestor and Google Doc imports.
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

  const proposedSlugs = Array.from(new Set(rows.map((r) => r.proposedSlug)));
  const currentBySlug = await listCurrentRulesBySlugs(session.orgId, proposedSlugs);

  return (
    <section>
      <header className="mb-8 flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-wider text-graphite">
          // suggestions
        </span>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Approval queue.
        </h1>
        <p className="max-w-2xl text-graphite-dark">
          Rules proposed by AI Suggestor or imported from Google Docs. Accepting
          a suggestion turns it into an active policy; the proxy applies it on
          the next request.
        </p>
      </header>
      <SuggestionsPanel
        initialSuggestions={sortSuggestionsForReview(rows)}
        currentBySlug={currentBySlug}
      />
    </section>
  );
}
