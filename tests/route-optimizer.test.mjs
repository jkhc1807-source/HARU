import assert from "node:assert/strict";
import test from "node:test";

test("교차하는 동선은 실제 거리가 짧아지도록 정리한다", async () => {
  const { optimizeRoute, routeDistance } = await import("../lib/route-optimizer.ts");
  const spot = (id, x, y) => ({ id, name: id, category: "", address: "", x, y, stay: 0, emoji: "" });
  const crossed = [spot("1", 0, 0), spot("2", 1, 1), spot("3", 0, 1), spot("4", 1, 0)];
  const optimized = optimizeRoute(crossed);

  assert.equal(optimized[0].id, "1");
  assert.ok(routeDistance(optimized) < routeDistance(crossed));
});
