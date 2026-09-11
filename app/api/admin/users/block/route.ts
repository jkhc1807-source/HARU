import { requireAdminUser } from "../../stats/route";

export async function POST(request: Request) {
  const auth = await requireAdminUser(request);
  if (auth.error) return auth.error;
  const { admin, userId } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }
  const payload = body as { userId?: unknown; isBlocked?: unknown };
  if (typeof payload.userId !== "string" || typeof payload.isBlocked !== "boolean") {
    return Response.json({ message: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }
  if (payload.userId === userId) {
    return Response.json({ message: "자기 계정은 차단할 수 없어요" }, { status: 400 });
  }

  const { error } = await admin.from("profiles")
    .update({ is_blocked: payload.isBlocked, updated_at: new Date().toISOString() })
    .eq("id", payload.userId);
  if (error) return Response.json({ message: "계정 상태를 바꾸지 못했어요" }, { status: 500 });

  await admin.from("admin_audit_logs").insert({
    admin_user_id: userId,
    action: payload.isBlocked ? "block_user" : "unblock_user",
    target_user_id: payload.userId,
  });

  return Response.json({ ok: true });
}
