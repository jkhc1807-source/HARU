import assert from "node:assert/strict";
import test from "node:test";

const origin = { placeName: "서울역", address: "서울 중구 한강대로 405", x: 126.9707, y: 37.5547 };

test("저장된 출발지는 좌표가 유효할 때만 복원한다", async () => {
  const { readStoredOrigin } = await import("../lib/origin-storage.ts");

  assert.deepEqual(readStoredOrigin(JSON.stringify(origin)), origin);
  assert.equal(readStoredOrigin(null), null);
  assert.equal(readStoredOrigin("{"), null);
  assert.equal(readStoredOrigin(JSON.stringify({ ...origin, x: "126.97" })), null);
  assert.equal(readStoredOrigin(JSON.stringify({ ...origin, placeName: 1 })), null);
});

test("즐겨찾기는 형식이 맞는 항목만 남긴다", async () => {
  const { readStoredFavoriteOrigins } = await import("../lib/origin-storage.ts");
  const valid = { ...origin, id: "a", label: "집", updatedAt: 10 };

  assert.deepEqual(readStoredFavoriteOrigins(JSON.stringify([valid, { id: "b" }, null])), [valid]);
  assert.deepEqual(readStoredFavoriteOrigins("{}"), []);
  assert.deepEqual(readStoredFavoriteOrigins(null), []);
});

test("같은 이름의 즐겨찾기는 최신 항목만 최신순으로 남긴다", async () => {
  const { mergeFavoriteOrigins } = await import("../lib/origin-storage.ts");
  const local = [{ ...origin, id: "a", label: "집", updatedAt: 10 }];
  const remote = [
    { ...origin, id: "b", label: "집", updatedAt: 20 },
    { ...origin, id: "c", label: "회사", updatedAt: 15 },
  ];

  assert.deepEqual(mergeFavoriteOrigins(local, remote).map(item => [item.label, item.updatedAt]), [
    ["집", 20],
    ["회사", 15],
  ]);
});
