import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the 하루여행 planner shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /<title>하루여행/);
  assert.match(html, /오늘 어디로/);
  assert.match(html, /나만의 하루 만들기/);
  assert.match(html, /Google로 로그인/);
  assert.match(html, /일정에 장소 더하기/);
  assert.match(html, /class="discovery-header"/);
  assert.equal((html.match(/class="place-category-icon"/g) || []).length, 4);
  assert.match(html, /카카오맵 리뷰/);
  assert.match(html, /role="status"/);
  const editors = [...html.matchAll(/<details class="spot-editor"[^>]*>([\s\S]*?)<\/details>/g)];
  assert.equal((html.match(/class="stop-actions"/g) || []).length, 4);
  assert.equal((html.match(/class="between-stops"/g) || []).length, 3);
  assert.equal(editors.length, 4, "Each sample stop has a collapsed editor");
  for (const [markup, content] of editors) {
    assert.doesNotMatch(markup.split(">", 1)[0], /\bopen(?:\s|=|$)/);
    assert.match(content, /시간·메모 수정/);
    assert.match(content, /체류 시간/);
    assert.match(content, /<textarea/);
  }
  const footers = [...html.matchAll(/<div class="spot-actions-footer">([\s\S]*?)<\/div>/g)];
  assert.equal(footers.length, 4);
  for (const [, content] of footers) assert.match(content, /장소 삭제<\/button>[\s\S]*class="confirm-spot-edit"[^>]*>확인<\/button>/);
  assert.match(html, /<input[^>]*aria-label="일정에 추가할 장소 검색"/);
});

test("keeps metadata and safe trip persistence logic in the app", async () => {
  const [page, layout, storage, schedule] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/trip-storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /lang="ko"/);
  assert.match(layout, /generateMetadata/);
  assert.match(layout, /og\.png/);
  assert.match(storage, /readStoredTrip/);
  assert.match(page, /localStorage\.removeItem\("haru-trip-plan"\)/);
  assert.match(page, /handleCityChange/);
  assert.match(page, /지역이 바뀌어 이전 일정을 비웠어요/);
  assert.match(page, /version: 2, city, startTime, endTime, selected, plan/);
  assert.match(page, /placeRequestRef/);
  assert.match(page, /regionRequestRef/);
  assert.doesNotMatch(schedule, /function visit\(permutation/);
  assert.match(schedule, /while \(improved\)/);
});
