import Link from "next/link";

import { EvidenceBrowser } from "./_components/evidence-browser";
import { PolicyPlayground } from "./_components/policy-playground";
import { SiteHeader } from "./_components/site-header";
import { WalletOwnedProfile } from "./_components/wallet-owned-profile";

const trustSignals = ["x402 paid agents", "arkiv evidence rail", "runtime policy firewall"];

const pillars = [
  {
    title: "Agentes que pagan antes de ejecutar",
    body: "Cada llamada protegida puede arrancar con un challenge x402. Si el agente firma el pago, ArkivGate evalua el prompt y deja el rastro.",
  },
  {
    title: "Politica antes del modelo",
    body: "La cascada decide BLOCK, REDACT, WARN o LOG antes de tocar el upstream. Los casos bloqueados funcionan incluso sin una API key de Claude.",
  },
  {
    title: "Evidencia que vive en Arkiv",
    body: "El agente pagador, la revision del prompt y la decision de politica quedan conectados como entidades verificables en Arkiv Network.",
  },
];

const proofCards = [
  {
    label: "payment gate",
    value: "402",
    body: "El runtime puede exigir pago x402 antes de ejecutar una llamada de agente.",
  },
  {
    label: "policy verdict",
    value: "4",
    body: "BLOCK, REDACT, WARN o LOG segun las reglas activas del equipo.",
  },
  {
    label: "proof layer",
    value: "Arkiv",
    body: "Cada ejecucion pagada puede dejar entidad, tx hash y link de explorer.",
  },
];

const flow = [
  {
    title: "Agent request",
    body: "Un agente o cliente AI intenta usar el runtime protegido.",
  },
  {
    title: "x402 challenge",
    body: "ArkivGate responde 402 si falta la firma de pago para ese recurso.",
  },
  {
    title: "Signed payment",
    body: "El agente firma el pago demo y reintenta contra el mismo endpoint.",
  },
  {
    title: "Policy cascade",
    body: "La cascada aplica reglas y decide si el modelo puede recibir el prompt.",
  },
  {
    title: "Arkiv proof",
    body: "El agente, la revision y la decision quedan persistidos como evidencia.",
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
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-graphite">arkivgate // paid ai governance runtime</p>

            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.02] md:text-6xl">
              Agentes que pagan, politicas que deciden, evidencia que queda.
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-graphite-dark md:text-lg">
              ArkivGate pone un gate x402 delante de las llamadas AI, aplica reglas antes del modelo y registra cada decision critica en Arkiv Network.
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
                x402 demo rail + policy enforcement + Arkiv proof para agentes de prueba.
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

      <WalletOwnedProfile />

      <EvidenceBrowser />

      <section id="producto" className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        <h2 className="mb-3 text-2xl font-semibold md:text-3xl">Producto</h2>
        <p className="mb-8 max-w-3xl text-sm leading-relaxed text-graphite-dark md:text-base">
          Una capa de control para agentes AI: cobra el acceso con x402, evalua el prompt en runtime y deja evidencia verificable para auditoria.
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
            Agente, Claude Code u otro cliente AI conectado al proxy de control.
          </ArchitectureCell>
          <ArchitectureCell title="02 / interceptor" tone="dark">
            Exige x402 cuando esta activo, evalua politicas y registra cada interaccion.
          </ArchitectureCell>
          <ArchitectureCell title="03 / web admin" tone="dark">
            Configura políticas, revisa eventos y gestiona el bridge.
          </ArchitectureCell>
          <ArchitectureCell title="04 / arkiv" tone="light">
            Almacena agente pagador, revision de prompt y decision como evidencia.
          </ArchitectureCell>
        </div>
      </section>

      <section id="roadmap" className="border-t border-graphite-dark/15 bg-[#113b44] text-[#e9f3f1]">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <h2 className="mb-3 text-2xl font-semibold md:text-3xl">Roadmap inmediato</h2>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-[#bcd9d3]">
            El MVP ya muestra el loop pagado. Lo siguiente es pasar de settlement demo a pagos reales y evidencia operacional completa.
          </p>

          <ul className="grid gap-3 text-sm text-[#d8ebe7] md:grid-cols-2">
            <li>Configurar settlement x402 real para agentes externos.</li>
            <li>Deploy del interceptor con `X402_DEMO_ENABLED=true` para demos controladas.</li>
            <li>Mostrar entidad de agente pagador en el panel admin.</li>
            <li>Validar E2E con pago, decision y prueba Arkiv en una sola vista.</li>
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
