// Admin shell. Sidebar + header + main slot.
/* eslint-disable react/jsx-no-comment-textnodes */
import Link from "next/link";
import { isAuthConfigured, signOut } from "@/auth";
import { ensureAdminSession } from "@/lib/admin-session";
import { readThemeCookie } from "@/lib/theme";
import { AdminShell } from "./_components/admin-shell";
import { ThemeSwitcher } from "./_components/theme-switcher";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await ensureAdminSession();

  if (!session) {
    return <>{children}</>;
  }

  const email = session.email;
  const orgId = session.orgId;
  const theme = await readThemeCookie();

  if (session.role === "dev") {
    return <DevForbidden email={email} orgId={orgId} />;
  }

  return (
    <div
      data-admin-shell
      data-theme={theme}
      className="flex h-svh flex-col overflow-hidden bg-paper text-ink"
    >
      <AdminShell
        email={email}
        orgId={orgId}
        authConfigured={isAuthConfigured()}
        signOut={isAuthConfigured() ? <SignOutButton /> : null}
        themeSwitcher={<ThemeSwitcher initial={theme} />}
      >
        {children}
      </AdminShell>
    </div>
  );
}

function DevForbidden({ email, orgId }: { email: string; orgId: string }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16">
        <div
          className="flex w-full flex-col gap-6 border border-graphite-dark/20 bg-paper p-8 md:p-10"
          style={{ borderRadius: "var(--radius)" }}
        >
          <span className="font-mono text-xs uppercase tracking-wider text-graphite">
            // forbidden
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">
            You are signed in as a developer.
          </h1>
          <p className="text-sm leading-relaxed text-graphite-dark">
            The back office is admin-only. You ({email}) are a developer in org{" "}
            <strong>{orgId}</strong>; keep using Claude Code normally. Your
            prompts are already attributed.
          </p>
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="font-mono text-[11px] uppercase tracking-wider text-graphite hover:text-ink"
            >
              back home
            </Link>
            <SignOutButton />
          </div>
        </div>
      </main>
    </div>
  );
}

function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button
        type="submit"
        className="border border-graphite-dark/35 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-graphite transition-colors hover:border-ink hover:text-ink"
        style={{ borderRadius: "var(--radius)" }}
      >
        sign out
      </button>
    </form>
  );
}
