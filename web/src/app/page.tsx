import Link from "next/link";

import { SiteHeader } from "./_components/site-header";

const pillars = [
  {
    title: "Policy firewall en runtime",
    body: "Cada prompt pasa por reglas verificables antes de llegar al modelo. Bloquea, redacta o deja pasar con trazabilidad.",
  },
  {
    title: "Evidencia en Arkiv",
    body: "Las decisiones críticas se registran como evidencia auditable para compliance, con contexto y timestamp.",
  },
  {
    title: "Backoffice operativo",
    body: "Tu equipo administra reglas, revisa eventos y valida impacto desde un panel único pensado para operación diaria.",
  },
];

const flow = [
  "Developer usa su cliente AI habitual",
  "Request entra al interceptor de ArkivGate",
  "Cascada de políticas decide BLOCK / REDACT / WARN / LOG",
  "Se persiste interacción en Postgres (Supabase)",
  "Bridge opcional escribe evidencia en Arkiv",
];

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col overflow-x-clip bg-paper text-ink">
      <SiteHeader />

      <section className="relative isolate border-b border-graphite-dark/15">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute left-0 top-0 h-56 w-56 rounded-full bg-paper-soft blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-paper-soft blur-3xl" />
        </div>

        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-6 pb-20 pt-16 md:grid-cols-2 md:pb-24 md:pt-24">
          <div className="space-y-6 rise">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-graphite">
              arkivgate / mvp
            </p>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight md:text-6xl">
              Frontend nuevo, limpio y separado para ArkivGate.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-graphite-dark md:text-lg">
              Esta versión elimina rastros del proyecto anterior y establece una
              base enfocada en producto, operación y auditoría para equipos AI.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/login"
                className="inline-flex items-center border border-ink bg-ink px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-paper transition-colors hover:bg-graphite-dark"
                style={{ borderRadius: "var(--radius)" }}
              >
                entrar al admin
              </Link>
              <Link
                href="/#arquitectura"
                className="inline-flex items-center border border-graphite-dark/25 bg-paper px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-ink transition-colors hover:bg-paper-soft"
                style={{ borderRadius: "var(--radius)" }}
              >
                ver arquitectura
              </Link>
            </div>
          </div>

          <div className="rise border border-graphite-dark/20 bg-paper-soft/35 p-6" style={{ borderRadius: "var(--radius)" }}>
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-graphite">
              estado del stack
            </p>
            <dl className="space-y-3 text-sm">
              <StatusRow label="Frontend" value="Next.js" />
              <StatusRow label="Base de datos" value="Postgres (Supabase)" />
              <StatusRow label="Interceptor" value="FastAPI" />
              <StatusRow label="Evidencia" value="Arkiv" />
              <StatusRow label="NL judge" value="Apagado (sin costo)" />
            </dl>
          </div>
        </div>
      </section>

      <section id="producto" className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        <h2 className="mb-8 text-2xl font-semibold md:text-3xl">Producto</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {pillars.map((pillar) => (
            <article
              key={pillar.title}
              className="border border-graphite-dark/20 bg-paper p-5"
              style={{ borderRadius: "var(--radius)" }}
            >
              <h3 className="mb-3 text-lg font-semibold">{pillar.title}</h3>
              <p className="text-sm leading-relaxed text-graphite-dark">{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="flujo"
        className="border-y border-graphite-dark/15 bg-paper-soft/30"
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <h2 className="mb-8 text-2xl font-semibold md:text-3xl">Flujo operativo</h2>
          <ol className="grid gap-4 md:grid-cols-2">
            {flow.map((step, index) => (
              <li
                key={step}
                className="flex items-start gap-4 border border-graphite-dark/20 bg-paper p-4"
                style={{ borderRadius: "var(--radius)" }}
              >
                <span className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center border border-ink font-mono text-xs">
                  {index + 1}
                </span>
                <span className="text-sm leading-relaxed text-graphite-dark">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="arquitectura" className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        <h2 className="mb-8 text-2xl font-semibold md:text-3xl">Arquitectura</h2>
        <div
          className="grid gap-px overflow-hidden border border-graphite-dark/20 bg-graphite-dark/10 md:grid-cols-4"
          style={{ borderRadius: "var(--radius)" }}
        >
          <ArchitectureCell title="Cliente">
            Claude Code o cliente AI conectado al proxy.
          </ArchitectureCell>
          <ArchitectureCell title="Interceptor">
            Evalúa políticas y registra interacción en DB.
          </ArchitectureCell>
          <ArchitectureCell title="Web/Admin">
            Configura políticas, revisa eventos y activa bridge.
          </ArchitectureCell>
          <ArchitectureCell title="Arkiv">
            Guarda evidencia audit trail para verificabilidad.
          </ArchitectureCell>
        </div>
      </section>

      <section id="roadmap" className="border-t border-graphite-dark/15 bg-paper-soft/25">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <h2 className="mb-5 text-2xl font-semibold md:text-3xl">Roadmap inmediato</h2>
          <ul className="grid gap-3 text-sm text-graphite-dark md:grid-cols-2">
            <li>Conectar dominio final en Vercel.</li>
            <li>Deploy de interceptor en Railway/Render.</li>
            <li>Fondear wallet Braga para writes en Arkiv.</li>
            <li>Validación E2E con evidencia visible en el panel.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-4 border-b border-graphite-dark/15 pb-2 last:border-b-0 last:pb-0">
      <dt className="font-mono text-xs uppercase tracking-wider text-graphite">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}

function ArchitectureCell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="bg-paper p-5">
      <h3 className="mb-2 font-mono text-xs uppercase tracking-[0.16em] text-graphite">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-graphite-dark">{children}</p>
    </article>
  );
}
