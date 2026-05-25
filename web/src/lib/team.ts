// Client-safe helpers shared by /admin/team UI and API payloads.

import type { Member } from "@prisma/client";

export type MemberDTO = {
  id: string;
  email: string;
  role: "admin" | "dev";
  // null if the invited member has not logged in yet.
  linkedAt: string | null;
  createdAt: string;
};

export function toMemberDTO(m: Member & { user?: { emailVerified: Date | null } | null }): MemberDTO {
  return {
    id: m.id,
    email: m.email,
    role: m.role as "admin" | "dev",
    linkedAt: m.userId
      ? m.user?.emailVerified?.toISOString() ?? new Date(0).toISOString()
      : null,
    createdAt: m.createdAt.toISOString(),
  };
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
