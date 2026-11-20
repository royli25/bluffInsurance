import type { Policy } from "./store";
export function businessSummary(policies: Policy[]) {
  const active = policies.filter((p) => p.status === "active");
  return {
    active: active.length,
    protectedEvents: new Set(active.map((p) => p.eventId)).size,
    premiums: policies
      .filter((p) => p.status !== "pending")
      .reduce((sum, p) => sum + p.premium, 0),
    pending: policies.filter(
      (p) => p.status === "pending" || p.status === "settling",
    ).length,
    paid: policies
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + p.payout, 0),
  };
}
export function contractStatus(policy: Pick<Policy, "status" | "arc">) {
  const labels = {
    pending: "Pending",
    active: "Active",
    settling: "Settling",
    paid: "Paid out",
    expired: "Completed",
  };
  return policy.arc.mode === "simulated" && policy.status === "paid"
    ? "Demo paid out"
    : labels[policy.status];
}
export function filterContracts(
  policies: Policy[],
  query = "",
  status = "all",
  eventId?: string,
) {
  const term = query.trim().toLowerCase();
  return policies.filter(
    (p) =>
      (!eventId || p.eventId === eventId) &&
      (status === "all" || p.status === status) &&
      (!term ||
        [p.id, p.eventTitle, p.holderName, p.coverageName].some((value) =>
          value.toLowerCase().includes(term),
        )),
  );
}
