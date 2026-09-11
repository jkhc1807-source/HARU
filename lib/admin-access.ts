export type AdminProfile = { role: string; is_blocked: boolean } | null;

export function readBearerToken(header: string | null) {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

export function decideAdminAccess(profile: AdminProfile) {
  if (!profile) return { allowed: false, status: 401 as const, reason: "로그인이 필요해요" };
  if (profile.is_blocked || profile.role !== "admin") {
    return { allowed: false, status: 403 as const, reason: "관리자만 볼 수 있는 화면이에요" };
  }
  return { allowed: true, status: 200 as const, reason: "" };
}
