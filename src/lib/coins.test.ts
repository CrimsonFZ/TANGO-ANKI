import assert from "node:assert/strict";
import test from "node:test";
import { getDateKey, getWeekdayMon1, getWeekStartDateKey, weeklyFullBonus, weeklyRewardTable } from "@/src/lib/coins";

test("weekly reward table and bonus constants", () => {
  assert.equal(weeklyRewardTable[1], 10);
  assert.equal(weeklyRewardTable[7], 22);
  assert.equal(weeklyFullBonus, 50);
});

test("getDateKey formats YYYY-MM-DD in server local time", () => {
  const date = new Date(2026, 1, 3); // 2026-02-03
  assert.equal(getDateKey(date), "2026-02-03");
});

test("getWeekdayMon1 maps Monday..Sunday to 1..7", () => {
  assert.equal(getWeekdayMon1(new Date(2026, 1, 2)), 1); // Monday
  assert.equal(getWeekdayMon1(new Date(2026, 1, 8)), 7); // Sunday
});

test("getWeekStartDateKey returns monday date key", () => {
  assert.equal(getWeekStartDateKey("2026-02-04"), "2026-02-02"); // Wednesday -> Monday
  assert.equal(getWeekStartDateKey("2026-02-08"), "2026-02-02"); // Sunday -> Monday
  assert.equal(getWeekStartDateKey("2026-02-09"), "2026-02-09"); // Monday -> Monday
});
