import { decideAdminAccess, readBearerToken } from "@/lib/admin-access";
import { getSupabaseAdminClient } from "@/lib/supabase/admin-server";

export async function requireAdminUser(request: Request) {
  const token = readBearerToken(request.headers.get("authorization"));
  if (!token) return { error: Response.json({ message: "로그인이 필요해요" }, { status: 401 }) };
  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return { error: Response.json({ message: "관리자 기능이 아직 설정되지 않았어요" }, { status: 503 }) };
  }
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { error: Response.json({ message: "로그인이 필요해요" }, { status: 401 }) };
  const { data: profile } = await admin.from("profiles").select("role,is_blocked").eq("id", data.user.id).maybeSingle();
  const decision = decideAdminAccess(profile ?? null);
  if (!decision.allowed) return { error: Response.json({ message: decision.reason }, { status: decision.status }) };
  return { admin, userId: data.user.id };
}

export async function GET(request: Request) {
  const auth = await requireAdminUser(request);
  if (auth.error) return auth.error;
  const { admin } = auth;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [users, newUsers, trips, favorites, blocked] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    admin.from("saved_trips").select("id", { count: "exact", head: true }),
    admin.from("favorite_origins").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_blocked", true),
  ]);
  return Response.json({
    userCount: users.count ?? 0,
    newUsersThisWeek: newUsers.count ?? 0,
    tripCount: trips.count ?? 0,
    favoriteCount: favorites.count ?? 0,
    blockedCount: blocked.count ?? 0,
  });
}
