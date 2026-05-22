import Link from "next/link";

import { PolicyPlayground } from "./_components/policy-playground";
import { SiteHeader } from "./_components/site-header";

const trustSignals = ["runtime policy firewall", "arkiv evidence rail", "operator-grade admin"];

const pillars = [
  {
    title: "Guardrails activos antes del modelo",
    body: "Cada prompt pasa por una cascada de reglas verificables. Decide BLOCK, REDACT, WARN o LOG sin frenar velocidad de entrega.",
  },
  {
    title: "Trazabilidad que si pasa auditoria",
    body: "Los eventos sensibles quedan con contexto, decision, actor y timestamp para revisiones internas, regulatorias o postmortem.",
  },
  {
    title: "Un cockpit para seguridad y producto",
    body: "Gestiona reglas, revisa alertas y mide impacto operativo desde una consola unica para equipos cross-funcionales.",
  },
];

const proofCards = [
  {
    label: "leak exposure",
    value: "-64%",
    body: "Menos riesgo de fuga de datos sensibles en interacciones de alto volumen.",
  },
  {
    label: "policy response",
    value: "x3",
    body: "Ajustes de reglas en minutos, no en ciclos largos de despliegue.",
  },
  {
    label: "audit readiness",
    value: "24/7",
    body: "Evidencia verificable siempre activa para compliance y governance.",
  },
];

const flow = [
  {
    title: "Client request",
    body: "Developer usa su cliente AI habitual sin cambiar su workflow.",
  },
  {
    title: "Runtime interception",
    body: "ArkivGate intercepta prompt y contexto antes del modelo.",
  },
  {
    title: "Policy cascade",
    body: "Reglas deterministicas ejecutan BLOCK, REDACT, WARN o LOG.",
  },
  {
    title: "Operational storage",
    body: "Interacciones y decisiones quedan en Postgres para operacion diaria.",
  },
  {
    title: "Proof layer",
    body: "Bridge opcional registra evidencia verificable en Arkiv Braga.",
  },
];

export default function HomePage() {
  return (
    <main className="landing-grid flex min-h-screen flex-col overflow-x-clip bg-paper text-ink">
      <SiteHeader />

      <section className="relative isolate overflow-hidden border-b border-graphite-dark/15">
        <div className="landing-glow pointer-events-none absolute inset-0 opacity-90" />

        <div className="relative mx-auto grid w-full max-w-6xl gap-8 px-6 pb-16 pt-14 md:grid-cols-[1.15fr_0.85fr] md:pb-20 md:pt-20">
          <div className="space-y-6 rise md:space-y-7">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-graphite">arkivgate // security runtime for ai</p>

            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.02] md:text-6xl">
              Tu stack AI puede escalar rapido y aun asi pasar compliance.
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-graphite-dark md:text-lg">
              ArkivGate crea una capa de control operativa entre la intencion del usuario y la respuesta del modelo. Menos riesgo, mas evidencia, mejor gobernanza.
            </p>

            <div className="flex flex-wrap gap-2">
              {trustSignals.map((signal) => (
                <span
                  key={signal}
                  className="border border-[#174a53]/35 bg-[#d6e5e6]/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#174a53]"
                >
                  {signal}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/login"
                className="inline-flex items-center border border-[#174a53] bg-[#174a53] px-5 py-2.5 font-mono text-xs uppercase tracking-[0.13em] text-[#eef4f2] transition-colors hover:bg-[#0f3a42]"
                style={{ borderRadius: "var(--radius)" }}
              >
                entrar al cockpit
              </Link>
              <Link
                href="/#flujo"
                className="inline-flex items-center border border-[#174a53]/35 bg-paper px-5 py-2.5 font-mono text-xs uppercase tracking-[0.13em] text-[#174a53] transition-colors hover:bg-[#e2eceb]"
                style={{ borderRadius: "var(--radius)" }}
              >
                ver flujo operativo
              </Link>
            </div>
          </div>

          <div
            className="rise border border-[#174a53]/35 bg-[#0f3138] p-5 text-[#d9ece8] shadow-[14px_14px_0_0_rgba(23,74,83,0.22)] md:p-6"
            style={{ borderRadius: "8px", animationDelay: "120ms" }}
          >
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-[#a8ccc5]">live policy board</p>

            <div className="space-y-3 border border-[#3f6a70] bg-[#123840] p-4" style={{ borderRadius: "6px" }}>
              <LiveRow title="requests inspected" value="122" />
              <LiveRow title="redactions" value="9" />
              <LiveRow title="blocked attempts" value="3" />
              <LiveRow title="critical leaks" value="0" emphasis />
            </div>

            <div className="mt-4 border border-[#3f6a70] bg-[#13343a] p-4" style={{ borderRadius: "6px" }}>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#9bc4bc]">current mode</p>
              <p className="mt-2 text-sm leading-relaxed text-[#def0ec]">
                Enforcement hard mode + Arkiv proof enabled para eventos de riesgo.
              </p>
            </div>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-6xl px-6 pb-10 md:pb-14">
          <div className="grid gap-3 md:grid-cols-3">
            {proofCards.map((card, index) => (
              <article
                key={card.label}
                className="rise border border-[#174a53]/30 bg-paper p-4"
                style={{ borderRadius: "6px", animationDelay: `${170 + index * 60}ms` }}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#1b5a65]">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold leading-none text-[#113b44]">{card.value}</p>
                <p className="mt-2 text-sm leading-relaxed text-graphite-dark">{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <PolicyPlayground />

      <section id="producto" className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        <h2 className="mb-3 text-2xl font-semibold md:text-3xl">Producto</h2>
        <p className="mb-8 max-w-3xl text-sm leading-relaxed text-graphite-dark md:text-base">
          Una capa de seguridad aplicada en runtime para operaciones AI de alto riesgo. Disenada para equipos que necesitan control sin frenar entrega.
        </p>
        <div className="grid gap-5 md:grid-cols-3">
          {pillars.map((pillar) => (
            <article
              key={pillar.title}
              className="border border-[#1b5a65]/25 bg-[#f3f7f6] p-5"
              style={{ borderRadius: "6px" }}
            >
              <h3 className="mb-3 text-lg font-semibold text-[#123c45]">{pillar.title}</h3>
              <p className="text-sm leading-relaxed text-graphite-dark">{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="flujo"
        className="border-y border-graphite-dark/15 bg-[#dbe9e8]/45"
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <h2 className="mb-8 text-2xl font-semibold md:text-3xl">Flujo operativo</h2>
          <ol className="grid gap-4 md:grid-cols-5">
            {flow.map((step, index) => (
              <li
                key={step.title}
                className="rise relative border border-[#1b5a65]/25 bg-paper p-4"
                style={{ borderRadius: "6px", animationDelay: `${80 + index * 60}ms` }}
              >
                <span className="mb-3 inline-flex h-7 min-w-7 items-center justify-center border border-[#1b5a65]/45 bg-[#edf5f4] font-mono text-xs text-[#1b5a65]">
                  0{index + 1}
                </span>
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.08em] text-[#123c45]">{step.title}</p>
                <p className="text-sm leading-relaxed text-graphite-dark">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="arquitectura" className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        <h2 className="mb-8 text-2xl font-semibold md:text-3xl">Arquitectura de referencia</h2>
        <div
          className="grid gap-4 md:grid-cols-2"
        >
          <ArchitectureCell title="01 / cliente" tone="light">
            Claude Code u otro cliente AI conectado al proxy de control.
          </ArchitectureCell>
          <ArchitectureCell title="02 / interceptor" tone="dark">
            Evalúa políticas y registra cada interacción en la base de datos.
          </ArchitectureCell>
          <ArchitectureCell title="03 / web admin" tone="dark">
            Configura políticas, revisa eventos y gestiona el bridge.
          </ArchitectureCell>
          <ArchitectureCell title="04 / arkiv" tone="light">
            Almacena evidencia auditable para verificabilidad externa.
          </ArchitectureCell>
        </div>
      </section>

      <section id="roadmap" className="border-t border-graphite-dark/15 bg-[#113b44] text-[#e9f3f1]">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <h2 className="mb-3 text-2xl font-semibold md:text-3xl">Roadmap inmediato</h2>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-[#bcd9d3]">
            Estamos cerrando la transicion de MVP a operacion productiva con governance completa.
          </p>

          <ul className="grid gap-3 text-sm text-[#d8ebe7] md:grid-cols-2">
            <li>Dominio final en Vercel y hardening de cabeceras.</li>
            <li>Deploy de interceptor en Railway o Render con observabilidad.</li>
            <li>Fondeo de wallet Braga para writes persistentes en Arkiv.</li>
            <li>Validacion E2E con evidencia trazable visible en panel admin.</li>
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/admin/login"
              className="inline-flex items-center border border-[#98c1b9] bg-[#e8f4f1] px-5 py-2.5 font-mono text-xs uppercase tracking-[0.13em] text-[#113b44] transition-colors hover:bg-white"
              style={{ borderRadius: "6px" }}
            >
              abrir panel
            </Link>
            <Link
              href="/#arquitectura"
              className="inline-flex items-center border border-[#4f7d77] px-5 py-2.5 font-mono text-xs uppercase tracking-[0.13em] text-[#d8ebe7] transition-colors hover:bg-[#164852]"
              style={{ borderRadius: "6px" }}
            >
              revisar arquitectura
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function LiveRow({
  title,
  value,
  emphasis,
}: {
  title: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[#3f6a70] pb-2 last:border-b-0 last:pb-0">
      <span className="font-mono text-[11px] uppercase tracking-[0.13em] text-[#98c1b9]">{title}</span>
      <span className={`text-lg font-semibold ${emphasis ? "text-[#99e7ce]" : "text-[#def0ec]"}`}>{value}</span>
    </div>
  );
}

function ArchitectureCell({
  title,
  children,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  tone: "light" | "dark";
}) {
  const isDark = tone === "dark";

  return (
    <article
      className={`drift border p-5 ${
        isDark
          ? "border-[#1f616c] bg-[#184a53] text-[#e8f4f1]"
          : "border-[#1f616c]/25 bg-[#eef5f4] text-[#123c45]"
      }`}
      style={{ borderRadius: "8px" }}
    >
      <h3
        className={`mb-2 font-mono text-xs uppercase tracking-[0.16em] ${
          isDark ? "text-[#a6ccc5]" : "text-[#1f616c]"
        }`}
      >
        {title}
      </h3>
      <p className={`text-sm leading-relaxed ${isDark ? "text-[#deefeb]" : "text-[#27525a]"}`}>{children}</p>
    </article>
  );
}
