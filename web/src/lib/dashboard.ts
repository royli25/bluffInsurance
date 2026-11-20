import type { Policy } from "./store";

const zone = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
});
const dayKey = (value: string | Date) => zone.format(new Date(value));

export function dashboardActivity(policies: Policy[], now = new Date()) {
  const today = dayKey(now);
  const end = new Date(`${today}T12:00:00Z`);
  const days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() - (29 - index));
    return { date: date.toISOString().slice(0, 10), premiums: 0, contracts: 0 };
  });
  const byDate = new Map(days.map((day) => [day.date, day]));
  for (const policy of policies) {
    if (policy.status === "pending") continue;
    const day = byDate.get(dayKey(policy.createdAt));
    if (day) { day.premiums += policy.premium; day.contracts += 1; }
  }
  return days.map((day) => ({ ...day, premiums: Math.round(day.premiums * 100) / 100 }));
}

export function dashboardEvents(policies: Policy[]) {
  const groups = new Map<string, { id: string; title: string; start: string; venue: string; contracts: number; active: number; premiums: number; paid: number }>();
  for (const policy of policies) {
    const event = groups.get(policy.eventId) ?? {
      id: policy.eventId, title: policy.eventTitle, start: policy.eventStart, venue: policy.venue,
      contracts: 0, active: 0, premiums: 0, paid: 0,
    };
    event.contracts += 1;
    if (policy.status === "active") event.active += 1;
    if (policy.status !== "pending") event.premiums += policy.premium;
    if (policy.status === "paid") event.paid += policy.payout;
    groups.set(event.id, event);
  }
  return [...groups.values()].sort((a, b) => b.premiums - a.premiums);
}
