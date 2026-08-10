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
  assert.match(html, /일정에 장소 더하기/);
  assert.match(html, /카카오맵 리뷰/);
  assert.match(html, /role="status"/);
});

test("keeps metadata and safe trip persistence logic in the app", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /lang="ko"/);
  assert.match(layout, /generateMetadata/);
  assert.match(layout, /og\.png/);
  assert.match(page, /readStoredTrip/);
  assert.match(page, /localStorage\.removeItem\("haru-trip-plan"\)/);
  assert.match(page, /handleCityChange/);
  assert.match(page, /지역이 바뀌어 이전 일정을 비웠어요/);
  assert.match(page, /version: 2, city, startTime, endTime, selected, plan/);
  assert.match(page, /placeRequestRef/);
  assert.match(page, /regionRequestRef/);
  assert.doesNotMatch(page, /function visit\(permutation/);
  assert.match(page, /while \(improved\)/);
});
