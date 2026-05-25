// /admin/rules - rules list + form for creating natural-language policies.
/* eslint-disable react/jsx-no-comment-textnodes */
import { getAdminSession } from "@/lib/admin-session";
import { listRules } from "@/lib/policies-server";
import { RulesPanel } from "./_components/rules-panel";
import { GdocImportForm } from "@/components/gdoc-import-form";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const session = await getAdminSession();
  if (!session) {
    return null;
  }
  const initialRules = await listRules(session.orgId);

  return (
    <section>
      <header className="mb-8 flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-wider text-graphite">
          // rules
        </span>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          What the firewall knows how to control.
        </h1>
        <p className="max-w-2xl text-graphite-dark">
          Every rule travels with each request. Write the policy in natural
          language; the judge decides whether the prompt violates it.
        </p>
      </header>

      <div
        className="mb-10 border border-graphite-dark/20 p-6"
        style={{ borderRadius: "var(--radius)" }}
      >
        <span className="mb-3 block font-mono text-xs uppercase tracking-wider text-graphite">
          // import from Google Docs
        </span>
        <GdocImportForm />
      </div>

      <RulesPanel initialRules={initialRules} />
    </section>
  );
}
