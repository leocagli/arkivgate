import { randomUUID } from "node:crypto";
import type { Adapter, AdapterAccount, AdapterUser } from "@auth/core/adapters";
import { restEq, supabaseRestFetch } from "@/lib/supabase-rest";

type AuthUserRow = {
  id: string;
  name: string | null;
  email: string;
  email_verified: string | null;
  image: string | null;
};

type AuthAccountRow = {
  id: string;
  user_id: string;
  type: AdapterAccount["type"];
  provider: string;
  provider_account_id: string;
  refresh_token: string | null;
  access_token: string | null;
  expires_at: number | null;
  token_type: string | null;
  scope: string | null;
  id_token: string | null;
  session_state: string | null;
};

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function toUser(row: AuthUserRow): AdapterUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.email_verified ? new Date(row.email_verified) : null,
    image: row.image,
  };
}

function toUserRow(user: Partial<AdapterUser>) {
  return stripUndefined({
    id: user.id,
    name: user.name ?? null,
    email: user.email,
    email_verified: user.emailVerified ? user.emailVerified.toISOString() : null,
    image: user.image ?? null,
  });
}

function toAccount(row: AuthAccountRow): AdapterAccount {
  return {
    userId: row.user_id,
    type: row.type,
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    refresh_token: row.refresh_token ?? undefined,
    access_token: row.access_token ?? undefined,
    expires_at: row.expires_at ?? undefined,
    token_type: row.token_type?.toLowerCase() as Lowercase<string> | undefined,
    scope: row.scope ?? undefined,
    id_token: row.id_token ?? undefined,
    session_state: row.session_state ?? undefined,
  };
}

function toAccountRow(account: AdapterAccount) {
  return stripUndefined({
    id: randomUUID(),
    user_id: account.userId,
    type: account.type,
    provider: account.provider,
    provider_account_id: account.providerAccountId,
    refresh_token: account.refresh_token,
    access_token: account.access_token,
    expires_at: account.expires_at,
    token_type: account.token_type,
    scope: account.scope,
    id_token: account.id_token,
    session_state: account.session_state,
  });
}

export function SupabaseRestAuthAdapter(): Adapter {
  return {
    async createUser(user) {
      const id = user.id ?? randomUUID();
      const rows = await supabaseRestFetch<AuthUserRow[]>("/auth_users", {
        method: "POST",
        body: JSON.stringify(toUserRow({ ...user, id })),
      });
      return toUser(rows[0]);
    },

    async getUser(id) {
      const rows = await supabaseRestFetch<AuthUserRow[]>(
        `/auth_users?select=id,name,email,email_verified,image&id=eq.${restEq(id)}&limit=1`,
      );
      return rows[0] ? toUser(rows[0]) : null;
    },

    async getUserByEmail(email) {
      const rows = await supabaseRestFetch<AuthUserRow[]>(
        `/auth_users?select=id,name,email,email_verified,image&email=eq.${restEq(email)}&limit=1`,
      );
      return rows[0] ? toUser(rows[0]) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const rows = await supabaseRestFetch<AuthAccountRow[]>(
        `/auth_accounts?select=id,user_id,type,provider,provider_account_id,refresh_token,access_token,expires_at,token_type,scope,id_token,session_state&provider=eq.${restEq(provider)}&provider_account_id=eq.${restEq(providerAccountId)}&limit=1`,
      );
      const account = rows[0];
      if (!account) return null;
      const users = await supabaseRestFetch<AuthUserRow[]>(
        `/auth_users?select=id,name,email,email_verified,image&id=eq.${restEq(account.user_id)}&limit=1`,
      );
      return users[0] ? toUser(users[0]) : null;
    },

    async updateUser(user) {
      const rows = await supabaseRestFetch<AuthUserRow[]>(
        `/auth_users?id=eq.${restEq(user.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(toUserRow(user)),
        },
      );
      return toUser(rows[0]);
    },

    async linkAccount(account) {
      const rows = await supabaseRestFetch<AuthAccountRow[]>("/auth_accounts", {
        method: "POST",
        body: JSON.stringify(toAccountRow(account)),
      });
      return rows[0] ? toAccount(rows[0]) : null;
    },

    async getAccount(providerAccountId, provider) {
      const rows = await supabaseRestFetch<AuthAccountRow[]>(
        `/auth_accounts?select=id,user_id,type,provider,provider_account_id,refresh_token,access_token,expires_at,token_type,scope,id_token,session_state&provider=eq.${restEq(provider)}&provider_account_id=eq.${restEq(providerAccountId)}&limit=1`,
      );
      return rows[0] ? toAccount(rows[0]) : null;
    },
  };
}
