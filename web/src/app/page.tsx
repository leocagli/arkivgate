import Link from "next/link";

import { EvidenceBrowser } from "./_components/evidence-browser";
import { PolicyPlayground } from "./_components/policy-playground";
import { SiteHeader } from "./_components/site-header";
import { WalletOwnedProfile } from "./_components/wallet-owned-profile";

const trustSignals = ["prompt firewall", "x402 payment guard", "wallet threat intel"];

const services = [
  {
    label: "01",
    title: "Prompt Firewall",
    body: "Interviene prompts maliciosos o sensibles antes de que lleguen al modelo. Puede bloquear, redactar, advertir o registrar.",
    signal: "BLOCK / REDACT / WARN / LOG",
  },
  {
    label: "02",
    title: "x402 Payment Guard",
    body: "Evalua la intencion de pago del agente: monto, balance, historial, cap por transaccion y comportamiento inusual.",
    signal: "100% balance = BLOCK",
  },
  {
    label: "03",
    title: "Wallet Threat Intel",
    body: "Chequea si el recipient esta reportado o parece sospechoso. Si hay riesgo comunitario, corta la ejecucion aunque el pago sea chico.",
    signal: "reported recipient = BLOCK",
  },
];

const pillars = [
  {
    title: "Un gate para prompts",
    body: "Detecta secretos, PII, credenciales y pedidos sospechosos antes del modelo.",
  },
  {
    title: "Un gate para pagos",
    body: "Evalua la operacion x402 por riesgo financiero, no solo por si esta firmada.",
  },
  {
    title: "Un gate para wallets",
    body: "Bloquea recipients reportados y guarda la evidencia conectada en Arkiv.",
  },
];

const proofCards = [
  {
    label: "prompt risk",
    value: "AI",
    body: "Secretos, datos sensibles y requests maliciosos se frenan antes del upstream.",
  },
  {
    label: "payment risk",
    value: "x402",
    body: "Un pago firmado igual puede bloquearse si intenta mover fondos de forma sospechosa.",
  },
  {
    label: "recipient risk",
    value: "Arkiv",
    body: "Wallets o contratos reportados quedan como threat evidence con TTL y relacion a la ejecucion.",
  },
];

const flow = [
  {
    title: "Agent request",
    body: "Un agente intenta ejecutar un prompt o una accion pagada.",
  },
  {
    title: "x402 challenge",
    body: "ArkivGate responde 402 si falta la firma de pago para ese recurso.",
  },
  {
    title: "Risk lanes",
    body: "Prompt, pago y recipient se evaluan con la misma salida: pass, warn, redact o block.",
  },
  {
    title: "Final decision",
    body: "La peor severidad gana. Un recipient reportado puede bloquear todo.",
  },
  {
    title: "Arkiv proof",
    body: "La decision y sus entidades relacionadas quedan como evidencia verificable.",
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
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-graphite">arkivgate // agent security gateway</p>

            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.02] md:text-6xl">
              Controla lo que el agente dice, paga y toca.
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-graphite-dark md:text-lg">
              Un solo runtime para frenar prompts maliciosos, pagos x402 riesgosos y recipients reportados. Cada decision queda conectada como evidencia en Arkiv.
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
                href="/#servicios"
                className="inline-flex items-center border border-[#174a53]/35 bg-paper px-5 py-2.5 font-mono text-xs uppercase tracking-[0.13em] text-[#174a53] transition-colors hover:bg-[#e2eceb]"
                style={{ borderRadius: "var(--radius)" }}
              >
                ver servicios
              </Link>
            </div>
          </div>

          <div
            className="rise border border-[#174a53]/35 bg-[#0f3138] p-5 text-[#d9ece8] shadow-[14px_14px_0_0_rgba(23,74,83,0.22)] md:p-6"
            style={{ borderRadius: "8px", animationDelay: "120ms" }}
          >
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-[#a8ccc5]">security decision board</p>

            <div className="space-y-3 border border-[#3f6a70] bg-[#123840] p-4" style={{ borderRadius: "6px" }}>
              <LiveRow title="prompt guard" value="active" />
              <LiveRow title="x402 guard" value="active" />
              <LiveRow title="wallet intel" value="active" />
              <LiveRow title="arkiv proof" value="on" emphasis />
            </div>

            <div className="mt-4 border border-[#3f6a70] bg-[#13343a] p-4" style={{ borderRadius: "6px" }}>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#9bc4bc]">current mode</p>
              <p className="mt-2 text-sm leading-relaxed text-[#def0ec]">
                Tres filtros en serie: contenido, fondos y recipient. La decision final se registra en Arkiv.
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

      <section id="servicios" className="mx-auto w-full max-w-6xl px-6 py-14 md:py-20">
        <div className="mb-7 max-w-3xl">
          <h2 className="text-2xl font-semibold md:text-3xl">Tres servicios en un mismo gate.</h2>
          <p className="mt-3 text-sm leading-relaxed text-graphite-dark md:text-base">
            ArkivGate no pregunta solamente si el agente pago. Pregunta si la accion es segura: contenido, fondos y recipient.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {services.map((service) => (
            <article
              key={service.title}
              className="border border-[#174a53]/25 bg-[#f4f8f7] p-5"
              style={{ borderRadius: "6px" }}
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#1b5a65]">{service.label}</p>
              <h3 className="mt-3 text-xl font-semibold text-[#113b44]">{service.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-graphite-dark">{service.body}</p>
              <p className="mt-5 border-t border-[#174a53]/20 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#1b5a65]">
                {service.signal}
              </p>
            </article>
          ))}
        </div>
      </section>

      <PolicyPlayground />

      <WalletOwnedProfile />

      <EvidenceBrowser />

      <section id="producto" className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        <h2 className="mb-3 text-2xl font-semibold md:text-3xl">Producto</h2>
        <p className="mb-8 max-w-3xl text-sm leading-relaxed text-graphite-dark md:text-base">
          Una capa de control para agentes AI: cobra el acceso con x402, evalua la accion completa y deja evidencia verificable para auditoria.
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
            El MVP ya muestra el loop completo. Lo siguiente es pasar de settlement demo a pagos reales y threat intelligence comunitaria editable por usuarios.
          </p>

          <ul className="grid gap-3 text-sm text-[#d8ebe7] md:grid-cols-2">
            <li>Configurar settlement x402 real para agentes externos.</li>
            <li>Deploy del interceptor con `X402_DEMO_ENABLED=true` para demos controladas.</li>
            <li>Permitir reportes comunitarios de wallets sospechosas desde la UI.</li>
            <li>Validar E2E con prompt, pago, recipient y prueba Arkiv en una sola vista.</li>
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
