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
    body: "Intercepts malicious or sensitive prompts before they reach the model. It can block, redact, warn, or log.",
    signal: "BLOCK / REDACT / WARN / LOG",
  },
  {
    label: "02",
    title: "x402 Payment Guard",
    body: "Evaluates the agent payment intent: amount, balance, history, per-transaction cap, and unusual behavior.",
    signal: "100% balance = BLOCK",
  },
  {
    label: "03",
    title: "Wallet Threat Intel",
    body: "Checks whether the recipient is reported or suspicious. If community risk exists, execution stops even for small payments.",
    signal: "reported recipient = BLOCK",
  },
];

const pillars = [
  {
    title: "A gate for prompts",
    body: "Detects secrets, PII, credentials, and suspicious requests before the model sees them.",
  },
  {
    title: "A gate for payments",
    body: "Scores the x402 operation by financial risk, not only by whether it was signed.",
  },
  {
    title: "A gate for wallets",
    body: "Blocks reported recipients and stores connected evidence in Arkiv.",
  },
];

const proofCards = [
  {
    label: "prompt risk",
    value: "AI",
    body: "Secrets, sensitive data, and malicious requests are stopped before the upstream model.",
  },
  {
    label: "payment risk",
    value: "x402",
    body: "A signed payment can still be blocked when it tries to move funds in a suspicious way.",
  },
  {
    label: "recipient risk",
    value: "Arkiv",
    body: "Reported wallets or contracts become threat evidence with TTL and links to the execution.",
  },
];

const flow = [
  {
    title: "Agent request",
    body: "An agent attempts to run a prompt or a paid action.",
  },
  {
    title: "x402 challenge",
    body: "ArkivGate returns 402 when the resource requires a payment signature.",
  },
  {
    title: "Risk lanes",
    body: "Prompt, payment, and recipient risk produce the same outputs: pass, warn, redact, or block.",
  },
  {
    title: "Final decision",
    body: "The strictest result wins. A reported recipient can block the whole execution.",
  },
  {
    title: "Arkiv proof",
    body: "The decision and related entities are stored as verifiable evidence.",
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
              Control what agents say, pay, and touch.
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-graphite-dark md:text-lg">
              One runtime for stopping malicious prompts, risky x402 payments, and reported recipients. Every decision is connected as evidence on Arkiv.
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
                open cockpit
              </Link>
              <Link
                href="/#services"
                className="inline-flex items-center border border-[#174a53]/35 bg-paper px-5 py-2.5 font-mono text-xs uppercase tracking-[0.13em] text-[#174a53] transition-colors hover:bg-[#e2eceb]"
                style={{ borderRadius: "var(--radius)" }}
              >
                view services
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
                Three filters in sequence: content, funds, and recipient. The final decision is stored on Arkiv.
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

      <section id="services" className="mx-auto w-full max-w-6xl px-6 py-14 md:py-20">
        <div className="mb-7 max-w-3xl">
          <h2 className="text-2xl font-semibold md:text-3xl">Three services in one gate.</h2>
          <p className="mt-3 text-sm leading-relaxed text-graphite-dark md:text-base">
            ArkivGate does not only ask whether the agent paid. It asks whether the action is safe: content, funds, and recipient.
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

      <section id="product" className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        <h2 className="mb-3 text-2xl font-semibold md:text-3xl">Product</h2>
        <p className="mb-8 max-w-3xl text-sm leading-relaxed text-graphite-dark md:text-base">
          A control layer for AI agents: charge access with x402, evaluate the full action, and leave verifiable evidence for audits.
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
        id="flow"
        className="border-y border-graphite-dark/15 bg-[#dbe9e8]/45"
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <h2 className="mb-8 text-2xl font-semibold md:text-3xl">Operating flow</h2>
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

      <section id="architecture" className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        <h2 className="mb-8 text-2xl font-semibold md:text-3xl">Reference architecture</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <ArchitectureCell title="01 / client" tone="light">
            Agent, Claude Code, or another AI client connected to the control proxy.
          </ArchitectureCell>
          <ArchitectureCell title="02 / interceptor" tone="dark">
            Requires x402 when active, evaluates policies, and records every interaction.
          </ArchitectureCell>
          <ArchitectureCell title="03 / web admin" tone="dark">
            Configures policies, reviews events, and manages the bridge.
          </ArchitectureCell>
          <ArchitectureCell title="04 / arkiv" tone="light">
            Stores payer agent, prompt review, and final decision as evidence.
          </ArchitectureCell>
        </div>
      </section>

      <section id="roadmap" className="border-t border-graphite-dark/15 bg-[#113b44] text-[#e9f3f1]">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <h2 className="mb-3 text-2xl font-semibold md:text-3xl">Immediate roadmap</h2>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-[#bcd9d3]">
            The MVP already shows the full loop. Next steps move from demo settlement to real payments and community-editable threat intelligence.
          </p>

          <ul className="grid gap-3 text-sm text-[#d8ebe7] md:grid-cols-2">
            <li>Configure real x402 settlement for external agents.</li>
            <li>Deploy the interceptor with `X402_DEMO_ENABLED=true` for controlled demos.</li>
            <li>Enable community reports for suspicious wallets from the UI.</li>
            <li>Validate prompt, payment, recipient, and Arkiv proof in one E2E view.</li>
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/admin/login"
              className="inline-flex items-center border border-[#98c1b9] bg-[#e8f4f1] px-5 py-2.5 font-mono text-xs uppercase tracking-[0.13em] text-[#113b44] transition-colors hover:bg-white"
              style={{ borderRadius: "6px" }}
            >
              open panel
            </Link>
            <Link
              href="/#architecture"
              className="inline-flex items-center border border-[#4f7d77] px-5 py-2.5 font-mono text-xs uppercase tracking-[0.13em] text-[#d8ebe7] transition-colors hover:bg-[#164852]"
              style={{ borderRadius: "6px" }}
            >
              review architecture
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
