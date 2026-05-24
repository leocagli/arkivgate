"use server";

import { redirect } from "next/navigation";
import { generateCliToken, hashCliToken } from "@/lib/cli-tokens";
import { getAuthedUser } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { hasSupabaseRestConfig, restEq, supabaseRestFetch } from "@/lib/supabase-rest";

type RestMember = {
  id: string;
};

type RestDeviceCode = {
  device_code: string;
  status: string;
  expires_at: string;
};

type RestCliToken = {
  id: string;
};

async function approveDeviceCodeWithRest(input: { userCode: string; userId: string }) {
  const memberRows = await supabaseRestFetch<RestMember[]>(
    `/members?select=id&user_id=eq.${restEq(input.userId)}&limit=1`,
  );
  const member = memberRows[0];
  if (!member) {
    throw new Error("no encontre member para este userId");
  }

  const codeRows = await supabaseRestFetch<RestDeviceCode[]>(
    `/cli_device_codes?select=device_code,status,expires_at&user_code=eq.${restEq(input.userCode)}&limit=1`,
  );
  const code = codeRows[0];
  if (!code) throw new Error("codigo invalido");
  if (code.status !== "pending") throw new Error(`codigo en estado ${code.status}`);
  if (new Date(code.expires_at).getTime() < Date.now()) throw new Error("codigo vencido");

  const token = generateCliToken();
  const tokenHash = hashCliToken(token);

  const tokenRows = await supabaseRestFetch<RestCliToken[]>("/cli_tokens", {
    method: "POST",
    body: JSON.stringify({
      member_id: member.id,
      token_hash: tokenHash,
      label: `CLI - ${new Date().toISOString().slice(0, 10)}`,
    }),
  });

  await supabaseRestFetch(`/cli_device_codes?device_code=eq.${restEq(code.device_code)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "approved",
      member_id: member.id,
      approved_at: new Date().toISOString(),
      issued_token_id: tokenRows[0].id,
      secret_token: token,
    }),
  });
}

export async function approveDeviceCode(formData: FormData) {
  const userCodeRaw = formData.get("userCode");
  if (typeof userCodeRaw !== "string" || !userCodeRaw) {
    redirect("/cli/connect?error=missing_code");
  }
  const userCode = userCodeRaw.toUpperCase();

  const authed = await getAuthedUser();
  if (!authed) {
    redirect(`/admin/login?callbackUrl=${encodeURIComponent(`/cli/connect?code=${userCode}`)}`);
  }

  try {
    const member = await prisma.member.findUnique({
      where: { userId: authed.userId },
    });
    if (!member) {
      throw new Error("no encontre member para este userId");
    }

    const code = await prisma.cliDeviceCode.findUnique({
      where: { userCode },
    });
    if (!code) throw new Error("codigo invalido");
    if (code.status !== "pending") throw new Error(`codigo en estado ${code.status}`);
    if (code.expiresAt.getTime() < Date.now()) throw new Error("codigo vencido");

    const token = generateCliToken();
    const tokenHash = hashCliToken(token);

    await prisma.$transaction(async (tx) => {
      const cliToken = await tx.cliToken.create({
        data: {
          memberId: member.id,
          tokenHash,
          label: `CLI - ${new Date().toISOString().slice(0, 10)}`,
        },
      });
      await tx.cliDeviceCode.update({
        where: { deviceCode: code.deviceCode },
        data: {
          status: "approved",
          memberId: member.id,
          approvedAt: new Date(),
          issuedTokenId: cliToken.id,
          secretToken: token,
        },
      });
    });
  } catch (err) {
    if (!hasSupabaseRestConfig()) throw err;
    console.warn("[cli-connect-approve] Prisma failed, falling back to Supabase REST:", err);
    await approveDeviceCodeWithRest({ userCode, userId: authed.userId });
  }

  redirect(`/cli/connect/done?code=${userCode}`);
}
