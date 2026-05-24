// /cli/connect?code=XXXX-XXXX â€” el dev abre esta pÃ¡gina desde el browser
// (lo manda el CLI). DespuÃ©s de loguear con Google, ve quiÃ©n va a quedar
// vinculado al CLI y puede aprobar.
/* eslint-disable react/jsx-no-comment-textnodes */

import { redirect } from "next/navigation";
import { isAuthConfigured } from "@/auth";
import { getAuthedUser } from "@/lib/admin-session";
import { joinViaCli } from "@/lib/org-resolution";
import { prisma } from "@/lib/prisma";
import { hasSupabaseRestConfig, restEq, supabaseRestFetch } from "@/lib/supabase-rest";
import { approveDeviceCode } from "./_actions";

export const dynamic = "force-dynamic";

type ConnectCode = {
  userCode: string;
  status: string;
  orgInviteId: string | null;
};

async function getConnectCode(userCode: string): Promise<ConnectCode | null> {
  try {
    return await prisma.cliDeviceCode.findUnique({
      where: { userCode: userCode.toUpperCase() },
    });
  } catch (err) {
    if (!hasSupabaseRestConfig()) throw err;
    console.warn("[cli-connect] Prisma failed, falling back to Supabase REST:", err);
  }

  const rows = await supabaseRestFetch<
    { user_code: string; status: string; org_invite_id: string | null }[]
  >(
    `/cli_device_codes?select=user_code,status,org_invite_id&user_code=eq.${restEq(userCode.toUpperCase())}&limit=1`,
  );
  const row = rows[0];
  return row
    ? {
        userCode: row.user_code,
        status: row.status,
        orgInviteId: row.org_invite_id,
      }
    : null;
}

export default async function CliConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code: userCode } = await searchParams;

  if (!isAuthConfigured()) {
    return (
      <ErrorScreen
        title="Auth no configurado"
        body="El servidor estÃ¡ corriendo en modo demo, sin Google OAuth. Pedile al admin que active GOOGLE_CLIENT_ID."
      />
    );
  }
  if (!userCode) {
    return (
      <ErrorScreen
        title="Falta el cÃ³digo"
        body="VolvÃ© al CLI y corrÃ© `npx ArkivGate setup` para que abra esta pÃ¡gina con el cÃ³digo correcto."
      />
    );
  }

  const authed = await getAuthedUser();
  if (!authed) {
    redirect(`/admin/login?callbackUrl=${encodeURIComponent(`/cli/connect?code=${userCode}`)}`);
  }

  const code = await getConnectCode(userCode);

  if (!code) {
    return (
      <ErrorScreen
        title="CÃ³digo invÃ¡lido"
        body={`No encontrÃ© el cÃ³digo ${userCode}. Pediste un nuevo \`npx ArkivGate setup\`?`}
      />
    );
  }
  if (code.status === "approved") {
    return (
      <ErrorScreen
        title="Ya estaba aprobado"
        body="Este cÃ³digo ya fue usado. Si necesitÃ¡s vincular otra terminal, corrÃ© `npx ArkivGate setup` de nuevo."
      />
    );
  }
  if (code.status === "expired") {
    return (
      <ErrorScreen
        title="CÃ³digo vencido"
        body="Pasaron mÃ¡s de 10 minutos desde que arrancaste el CLI. CorrÃ© `npx ArkivGate setup` de nuevo."
      />
    );
  }

  // Resolvemos la org del user respecto del device code:
  // - Si ya tiene member â†’ ese gana.
  // - Si no, y el device code tiene org_invite_id â†’ joinea como dev.
  // - Si no â†’ mostramos error "no perteneces".
  const join = await joinViaCli({
    userId: authed!.userId,
    email: authed!.email,
    name: authed!.name,
    orgInviteId: code.orgInviteId ?? null,
  });

  if (!join.ok) {
    if (join.error.kind === "no_invite") {
      return (
        <ErrorScreen
          title="No perteneces a ninguna organizaciÃ³n"
          body={`No encontrÃ© ninguna invitaciÃ³n para ${join.error.email}. Pedile a tu admin que te invite por email desde /admin/team, o que te pase el comando con --org-id.`}
        />
      );
    }
    if (join.error.kind === "org_not_found") {
      return (
        <ErrorScreen
          title="Org no encontrada"
          body={`No existe la organizaciÃ³n "${join.error.orgId}". VerificÃ¡ el id con tu admin.`}
        />
      );
    }
    return (
      <ErrorScreen
        title="Ya perteneces a otra organizaciÃ³n"
        body={`EstÃ¡s vinculado a "${join.error.currentOrgId}". Para cambiar de org, corrÃ© "npx ArkivGate logout" primero.`}
      />
    );
  }

  return (
    <Shell>
      <span className="font-mono text-xs uppercase tracking-wider text-graphite">
        // autorizar cli
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">
        Â¿VinculÃ¡s esta terminal a tu cuenta?
      </h1>
      <p className="text-sm leading-relaxed text-graphite-dark">
        Vas a quedar identificado como <strong>{authed!.email}</strong> en la
        org <strong>{join.resolution.orgId}</strong> con rol{" "}
        <strong>{join.resolution.role}</strong>. Cada prompt de Claude Code que
        pase por ArkivGate va a quedar atribuido a vos.
      </p>

      <div
        className="border border-graphite-dark/20 bg-paper-soft/40 px-4 py-3"
        style={{ borderRadius: "var(--radius)" }}
      >
        <p className="font-mono text-[11px] uppercase tracking-wider text-graphite">
          // user code
        </p>
        <p className="mt-1 font-mono text-2xl tracking-widest text-ink">
          {code.userCode}
        </p>
        <p className="mt-2 font-mono text-[11px] text-graphite">
          // confirmÃ¡ que coincide con el que muestra tu CLI
        </p>
      </div>

      <form action={approveDeviceCode} className="flex flex-col gap-3">
        <input type="hidden" name="userCode" value={code.userCode} />
        <button
          type="submit"
          className="bg-ink px-6 py-3 font-medium text-paper transition-colors hover:bg-graphite-dark"
          style={{ borderRadius: "var(--radius)" }}
        >
          Autorizar CLI
        </button>
        <p className="font-mono text-[11px] leading-relaxed text-graphite">
          // si no fuiste vos quien pidiÃ³ esto, simplemente cerrÃ¡ la pestaÃ±a.
          el cÃ³digo vence en 10 min.
        </p>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16">
        <div
          className="flex w-full flex-col gap-6 border border-graphite-dark/20 bg-paper p-8 md:p-10"
          style={{ borderRadius: "var(--radius)" }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

function ErrorScreen({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-ink">
        <span aria-hidden className="h-3 w-1 bg-ink" />
        // error
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm leading-relaxed text-graphite-dark">{body}</p>
    </Shell>
  );
}

