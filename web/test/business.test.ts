import { test } from "node:test";
import assert from "node:assert/strict";
import { businessSummary, filterContracts } from "../src/lib/business";
import { policy } from "./helpers/streams-fixtures";
test("business totals count customer contracts and distinct active events, excluding pending premiums", () => {
  const rows = [
    { ...policy("active-1"), status: "active" as const, premium: 10 },
    { ...policy("active-2"), status: "active" as const, premium: 12 },
    {
      ...policy("paid"),
      eventId: "other-event",
      status: "paid" as const,
      premium: 8,
      payout: 50,
    },
    { ...policy("pending"), status: "pending" as const, premium: 100 },
  ];
  assert.deepEqual(businessSummary(rows), {
    active: 2,
    protectedEvents: 1,
    premiums: 30,
    pending: 1,
    paid: 50,
  });
  assert.equal(filterContracts(rows, "", "paid", "other-event").length, 1);
  assert.equal(filterContracts(rows, "ACTIVE-1", "active").length, 1);
});
