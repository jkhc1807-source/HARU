import { requireAdminUser } from "../stats/route";

export async function GET(request: Request) {
  const auth = await requireAdminUser(request);
  if (auth.error) return auth.error;
  const { admin } = auth;
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id,email,display_name,role,is_blocked,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return Response.json({ message: "계정 목록을 불러오지 못했어요" }, { status: 500 });

  const { data: trips } = await admin.from("saved_trips").select("user_id");
  const tripCountByUser = new Map<string, number>();
  for (const row of trips ?? []) {
    const userId = (row as { user_id: string }).user_id;
    tripCountByUser.set(userId, (tripCountByUser.get(userId) ?? 0) + 1);
  }

  return Response.json({
    users: (profiles ?? []).map(profile => ({
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name,
      role: profile.role,
      isBlocked: profile.is_blocked,
      createdAt: profile.created_at,
      tripCount: tripCountByUser.get(profile.id) ?? 0,
    })),
  });
}
