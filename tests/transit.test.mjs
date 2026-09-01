import assert from "node:assert/strict";
import test from "node:test";

test("교통편은 일정의 출발지만 조회한다", async () => {
  const { findDepartureTransit } = await import("../lib/transit.ts");
  const calls = [];
  const plan = [
    { id: "start", name: "출발지", x: 127, y: 37.5 },
    { id: "next", name: "다음 장소", x: 128, y: 38 },
  ];

  const result = await findDepartureTransit(plan, async (spot, query, categoryCode) => {
    calls.push([spot.id, query, categoryCode]);
    return [{ place_name: categoryCode === "SW8" ? "가까운역" : "가까운정류장" }];
  });

  assert.deepEqual(calls, [
    ["start", "", "SW8"],
    ["start", "버스정류장", undefined],
  ]);
  assert.deepEqual(result, { start: { subway: "가까운역", bus: "가까운정류장" } });
});
