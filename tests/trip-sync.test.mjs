import assert from "node:assert/strict";
import test from "node:test";
import { mergeSavedTrips } from "../lib/trip-sync.ts";

const trip = (id, name, updatedAt) => ({
  version: 2,
  id,
  name,
  city: "성수동",
  startTime: "10:00",
  endTime: "18:00",
  selected: ["카페"],
  plan: [],
  updatedAt,
});

test("동일한 일정 이름은 최신 항목 하나만 유지한다", () => {
  assert.deepEqual(
    mergeSavedTrips([trip("local", "성수 하루", 10)], [trip("remote", "성수 하루", 20)]).map(item => item.id),
    ["remote"],
  );
});

test("서로 다른 일정은 최신순 최대 12개로 합친다", () => {
  const local = Array.from({ length: 8 }, (_, i) => trip(`l${i}`, `로컬 ${i}`, i));
  const remote = Array.from({ length: 8 }, (_, i) => trip(`r${i}`, `원격 ${i}`, i + 20));
  const merged = mergeSavedTrips(local, remote);
  assert.equal(merged.length, 12);
  assert.equal(merged[0].id, "r7");
});
