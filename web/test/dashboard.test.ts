import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardActivity, dashboardEvents } from "../src/lib/dashboard";
import { policy } from "./helpers/streams-fixtures";

test("premium activity uses Chicago calendar days and excludes unconfirmed and out-of-range premiums", () => {
  const rows = [
    { ...policy("active"), createdAt: "2026-11-20T12:00:00Z", status: "active" as const, premium: 10 },
    { ...policy("paid"), createdAt: "2026-11-21T02:00:00Z", status: "paid" as const, premium: 5 },
    { ...policy("pending"), createdAt: "2026-11-20T12:00:00Z", status: "pending" as const, premium: 200 },
    { ...policy("old"), createdAt: "2026-10-01T12:00:00Z", status: "paid" as const, premium: 100 },
    { ...policy("future"), createdAt: "2026-11-22T12:00:00Z", status: "active" as const, premium: 100 },
  ];
  const days = dashboardActivity(rows, new Date("2026-11-20T16:00:00Z"));
  assert.equal(days.length, 30);
  assert.equal(days[0].date, "2026-10-22");
  assert.deepEqual(days[29], { date: "2026-11-20", premiums: 15, contracts: 2 });
  assert.equal(days.reduce((sum, day) => sum + day.premiums, 0), 15);
});

test("game summaries distinguish historical sales, active protection, and payouts", () => {
  const rows = [
    { ...policy("one"), eventId: "game-a", status: "active" as const, premium: 10 },
    { ...policy("two"), eventId: "game-a", status: "paid" as const, premium: 5, payout: 40 },
    { ...policy("three"), eventId: "game-a", status: "pending" as const, premium: 90 },
    { ...policy("four"), eventId: "game-b", status: "expired" as const, premium: 2 },
  ];
  const events = dashboardEvents(rows);
  assert.deepEqual(events.map(({ id, contracts, active, premiums, paid }) => ({ id, contracts, active, premiums, paid })), [
    { id: "game-a", contracts: 3, active: 1, premiums: 15, paid: 40 },
    { id: "game-b", contracts: 1, active: 0, premiums: 2, paid: 0 },
  ]);
});

test("empty portfolios render zero activity instead of invented chart data", () => {
  assert.deepEqual(dashboardEvents([]), []);
  const days = dashboardActivity([], new Date("2026-11-20T12:00:00Z"));
  assert.equal(days.length, 30);
  assert.ok(days.every((day) => day.premiums === 0 && day.contracts === 0));
});
