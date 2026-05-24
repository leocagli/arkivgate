type SupabaseRestConfig = {
  baseUrl: string;
  headers: Record<string, string>;
};

function supabaseRestConfig(): SupabaseRestConfig {
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

export function hasSupabaseRestConfig(): boolean {
  return Boolean(process.env.SUPABASE_PROJECT_ID && process.env.SUPABASE_SECRET_KEY);
}

export async function supabaseRestFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, headers } = supabaseRestConfig();
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

  return (text ? JSON.parse(text) : null) as T;
}

export function restEq(value: string): string {
  return encodeURIComponent(value);
}
