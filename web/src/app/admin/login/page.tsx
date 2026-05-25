/* eslint-disable react/jsx-no-comment-textnodes */

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, isAuthConfigured, signIn } from "@/auth";
import { SiteHeader } from "@/app/_components/site-header";
import { GridBackdrop } from "@/app/_components/grid-backdrop";
import { BrandMark } from "@/components/brand-mark";

const REPO_URL = "https://github.com/leocagli/arkivgate";

function safeCallbackUrl(raw: string | undefined): string {
  if (!raw) return "/admin";
  if (!raw.startsWith("/")) return "/admin";
  if (raw.startsWith("//")) return "/admin";
  return raw;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  if (!isAuthConfigured()) {
    redirect("/");
  }
  const { callbackUrl: raw, error } = await searchParams;
  const callbackUrl = safeCallbackUrl(raw);

  const session = await auth();
  if (session?.user) {
    redirect(callbackUrl);
  }

  return (
    <div className="relative isolate flex min-h-svh flex-col bg-paper text-ink">
      <SiteHeader />

      <main className="relative grid w-full flex-1 place-items-center px-6 py-10">
        <GridBackdrop variant="paper" />

        <div className="relative w-full max-w-lg">
          <div className="rise mb-8 flex flex-wrap items-baseline justify-between gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-graphite">
              <span aria-hidden className="mr-2 text-ink">
                +
              </span>
              sys.online // op.ready
            </span>
            <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.28em] text-graphite">
              <span
                aria-hidden
                className="hero-dot block h-1.5 w-1.5 rounded-full bg-ink"
              />
              admin / login
            </span>
          </div>

          <div
            className="rise flex w-full flex-col gap-7 border border-graphite-dark/20 bg-paper/85 p-8 shadow-[0_30px_80px_-50px_rgba(28,27,24,0.45)] backdrop-blur-sm md:p-10"
            style={{ animationDelay: "120ms", borderRadius: "var(--radius)" }}
          >
            <div className="flex items-center gap-3">
              <BrandMark decorative className="h-7 w-7 text-ink" />
              <span className="text-xl font-semibold lowercase tracking-tight">
                arkivgate
              </span>
              <span className="ml-2 border-l border-graphite-dark/20 pl-3 font-mono text-xs uppercase tracking-wider text-graphite">
                admin
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-mono text-xs uppercase tracking-wider text-graphite">
                // sign in
              </span>
              <h1 className="text-3xl font-semibold leading-[1.05] tracking-tight md:text-4xl">
                Open the cockpit.
              </h1>
              <p className="max-w-sm text-sm leading-relaxed text-graphite-dark">
                Continue with Google. If you were invited, you enter your
                team's organization. If not, ArkivGate creates a new org with
                you as admin owner.
              </p>
            </div>

            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: callbackUrl });
              }}
            >
              <button
                type="submit"
                className="group flex w-full items-center justify-center gap-3 bg-ink px-6 py-3.5 font-medium text-paper transition-colors hover:bg-graphite-dark"
                style={{ borderRadius: "var(--radius)" }}
              >
                <GoogleMark className="h-5 w-5" />
                Continue with Google
                <span
                  aria-hidden
                  className="ml-1 transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </button>
            </form>

            {error ? (
              <div
                className="border border-[#8a2d2d]/25 bg-[#f8e7e7] p-3 text-sm leading-relaxed text-[#8a2d2d]"
                style={{ borderRadius: "var(--radius)" }}
              >
                Google did not complete the callback. Start the sign-in flow again from this button.
              </div>
            ) : null}

            <p className="font-mono text-[11px] leading-relaxed text-graphite">
              // we only store email, name, and avatar.
              <br />
              // no Gmail tokens, no tracking.
            </p>
          </div>

          <div
            className="rise mt-6 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.22em] text-graphite"
            style={{ animationDelay: "240ms" }}
          >
            <Link href="/" className="transition-colors hover:text-ink">
              ← back home
            </Link>
            <Link
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-ink"
            >
              github →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function GoogleMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="#fff"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#fff"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
        opacity=".75"
      />
      <path
        fill="#fff"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.83z"
        opacity=".55"
      />
      <path
        fill="#fff"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
        opacity=".35"
      />
    </svg>
  );
}
