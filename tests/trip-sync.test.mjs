import assert from "node:assert/strict";
import test from "node:test";
import { mergeSavedTrips, savedTripsFromRows } from "../lib/trip-sync.ts";

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

test("원격 일정은 유효한 장소 구조만 받아들인다", () => {
  const validPlan = [{ id: "1", name: "서울숲", category: "산책", address: "서울", x: 127, y: 37, stay: 60, emoji: "🌿" }];
  const rows = [
    { id: "ok", user_id: "user", name: "정상", city: "성수동", start_time: "10:00", end_time: "18:00", preferences: ["산책"], plan: validPlan, updated_at: "2026-09-01T00:00:00.000Z" },
    { id: "bad", user_id: "user", name: "손상", city: "성수동", start_time: "10:00", end_time: "18:00", preferences: [], plan: [{ name: "좌표 없음" }], updated_at: "invalid" },
  ];
  assert.deepEqual(savedTripsFromRows(rows).map(item => item.id), ["ok"]);
});

test("원격 일정의 메모와 장소 링크는 문자열만 허용한다", () => {
  const plan = [{ id: "1", name: "서울숲", category: "산책", address: "서울", x: 127, y: 37, stay: 60, emoji: "🌿", note: {} }];
  const rows = [{ id: "bad-note", name: "손상", city: "성수동", preferences: [], plan, updated_at: "2026-09-01T00:00:00.000Z" }];
  assert.deepEqual(savedTripsFromRows(rows), []);
});
