import { hashCliToken } from "@/lib/cli-tokens";

function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

function supabaseConfig() {
  const projectId = process.env.SUPABASE_PROJECT_ID;
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!projectId || !secret) {
    throw new Error("Missing SUPABASE_PROJECT_ID or SUPABASE_SECRET_KEY");
  }

  return {
    baseUrl: `https://${projectId}.supabase.co/rest/v1`,
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      "User-Agent": "vercel",
    },
  };
}

async function supabaseFetch(path: string, init?: RequestInit) {
  const { baseUrl, headers } = supabaseConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase ${path} ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

type Body = {
  token?: string;
};

export async function POST(request: Request) {
  const bridgeToken = process.env.ARKIV_BRIDGE_TOKEN;
  const headerToken = request.headers.get("x-arkiv-bridge-token");

  if (!bridgeToken || headerToken !== bridgeToken) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const token = body?.token?.trim();
  if (!token?.startsWith("tk_")) {
    return Response.json({ error: "invalid token" }, { status: 400 });
  }

  const tokenHash = hashCliToken(token);
  const tokenRows = await supabaseFetch(
    `/cli_tokens?select=id,member_id,revoked_at&token_hash=eq.${tokenHash}&limit=1`,
  );
  const row = Array.isArray(tokenRows) ? tokenRows[0] : null;

  if (!row || row.revoked_at || !row.member_id) {
    return Response.json({ error: "unknown or revoked arkivgate token" }, { status: 401 });
  }

  void supabaseFetch(`/cli_tokens?id=eq.${row.id}`, {
    method: "PATCH",
    body: JSON.stringify({ last_used_at: new Date().toISOString() }),
  }).catch(() => {});

  const memberRows = await supabaseFetch(
    `/members?select=id,org_id,email&id=eq.${row.member_id}&limit=1`,
  );
  const member = Array.isArray(memberRows) ? memberRows[0] : null;

  if (!member) {
    return Response.json({ error: "dangling token" }, { status: 401 });
  }

  const policies = await supabaseFetch(
    `/policies?select=id,org_id,slug,domain,layer,rule,pattern,default_action,severity,source,is_active,created_at,updated_at&org_id=eq.${member.org_id}&is_active=is.true&order=layer.asc,created_at.asc`,
  );

  return Response.json({
    ok: true,
    caller: {
      memberId: member.id,
      orgId: member.org_id,
      email: member.email,
    },
    policies: (Array.isArray(policies) ? policies : []).map((policy) => ({
      id: policy.id,
      orgId: policy.org_id,
      slug: policy.slug,
      domain: policy.domain,
      layer: policy.layer,
      rule: policy.rule,
      pattern: policy.pattern,
      defaultAction: policy.default_action,
      severity: policy.severity,
      source: policy.source,
      isActive: policy.is_active,
      createdAt: policy.created_at,
      updatedAt: policy.updated_at,
    })),
  });
}