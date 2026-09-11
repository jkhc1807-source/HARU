import assert from "node:assert/strict";
import test from "node:test";

test("교통편은 전달받은 출발지만 조회한다", async () => {
  const { findDepartureTransit } = await import("../lib/transit.ts");
  const calls = [];
  const departure = { id: "origin", x: 127, y: 37.5 };

  const result = await findDepartureTransit(departure, async (spot, query, categoryCode) => {
    calls.push([spot.id, query, categoryCode]);
    return [{ place_name: categoryCode === "SW8" ? "가까운역" : "가까운정류장" }];
  });

  assert.deepEqual(calls, [
    ["origin", "", "SW8"],
    ["origin", "버스정류장", undefined],
  ]);
  assert.deepEqual(result, { origin: { subway: "가까운역", bus: "가까운정류장" } });
});

test("출발지가 없으면 아무것도 조회하지 않는다", async () => {
  const { findDepartureTransit } = await import("../lib/transit.ts");
  const calls = [];

  const result = await findDepartureTransit(null, async spot => {
    calls.push(spot.id);
    return [];
  });

  assert.deepEqual(calls, []);
  assert.deepEqual(result, {});
});
