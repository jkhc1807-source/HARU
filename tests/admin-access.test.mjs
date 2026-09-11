import assert from "node:assert/strict";
import test from "node:test";

test("Bearer 토큰만 읽어들인다", async () => {
  const { readBearerToken } = await import("../lib/admin-access.ts");

  assert.equal(readBearerToken("Bearer abc.def"), "abc.def");
  assert.equal(readBearerToken("bearer abc.def"), "abc.def");
  assert.equal(readBearerToken("Basic abc"), null);
  assert.equal(readBearerToken("Bearer "), null);
  assert.equal(readBearerToken(null), null);
});

test("관리자만 허용하고 차단 계정은 거부한다", async () => {
  const { decideAdminAccess } = await import("../lib/admin-access.ts");

  assert.deepEqual(decideAdminAccess({ role: "admin", is_blocked: false }), { allowed: true, status: 200, reason: "" });
  assert.equal(decideAdminAccess({ role: "user", is_blocked: false }).status, 403);
  assert.equal(decideAdminAccess({ role: "admin", is_blocked: true }).status, 403);
  assert.equal(decideAdminAccess(null).status, 401);
});

test("거부 사유에 내부 정보를 노출하지 않는다", async () => {
  const { decideAdminAccess } = await import("../lib/admin-access.ts");

  for (const profile of [null, { role: "user", is_blocked: false }, { role: "admin", is_blocked: true }]) {
    const { reason } = decideAdminAccess(profile);
    assert.ok(reason.length > 0);
    assert.ok(!/role|is_blocked|supabase|service/i.test(reason));
  }
});
