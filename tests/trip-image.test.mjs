import assert from "node:assert/strict";
import test from "node:test";

const input = {
  city: "성수동",
  startTime: "09:30",
  endTime: "14:30",
  totalMinutes: 303,
  walkMinutes: 33,
  stops: [
    { order: 1, name: "서울숲", category: "산책", start: "09:30", end: "10:40" },
    { order: 2, name: "대림창고", category: "카페", start: "11:03", end: "12:03" },
  ],
};

function textsOf(layout) {
  return layout.ops.filter(op => op.type === "text").map(op => op.text);
}

test("이미지 레이아웃에 지역, 시간 요약, 모든 장소가 들어간다", async () => {
  const { buildTripImageLayout } = await import("../lib/trip-image.ts");
  const layout = buildTripImageLayout(input);
  const texts = textsOf(layout);

  assert.ok(texts.some(text => text.includes("성수동")));
  assert.ok(texts.some(text => text.includes("5시간 3분")));
  assert.ok(texts.some(text => text.includes("도보 33분")));
  assert.ok(texts.includes("서울숲"));
  assert.ok(texts.includes("대림창고"));
  assert.ok(texts.some(text => text.includes("09:30")));
});

test("장소가 늘어나면 이미지 높이도 늘어난다", async () => {
  const { buildTripImageLayout } = await import("../lib/trip-image.ts");
  const short = buildTripImageLayout({ ...input, stops: input.stops.slice(0, 1) });
  const long = buildTripImageLayout(input);

  assert.ok(long.height > short.height);
  assert.equal(long.width, short.width);
});

test("장소가 없어도 안내 문구를 담은 레이아웃을 만든다", async () => {
  const { buildTripImageLayout } = await import("../lib/trip-image.ts");
  const layout = buildTripImageLayout({ ...input, stops: [], totalMinutes: 0, walkMinutes: 0 });

  assert.ok(layout.height > 0);
  assert.ok(textsOf(layout).some(text => text.includes("아직 담은 장소가 없어요")));
});

test("긴 장소 이름은 잘려서 카드 밖으로 넘치지 않는다", async () => {
  const { buildTripImageLayout } = await import("../lib/trip-image.ts");
  const longName = "아주아주기다란장소이름".repeat(6);
  const layout = buildTripImageLayout({ ...input, stops: [{ order: 1, name: longName, category: "카페", start: "09:30", end: "10:30" }] });
  const drawnName = textsOf(layout).find(text => text.startsWith("아주아주"));

  assert.ok(drawnName.length < longName.length);
  assert.ok(drawnName.endsWith("…"));
});
