import type { Policy } from "./store";
export function policyStatusText(policy: Policy) {
  if (policy.status === "pending") return "Awaiting Arc purchase confirmation";
  if (policy.status === "settling")
    return policy.settlementError
      ? "Settlement needs reconciliation"
      : "Payout awaiting Arc confirmation";
  if (policy.status === "paid")
    return policy.arc.mode === "simulated"
      ? "Demo refund completed"
      : "USDC payout confirmed on Arc";
  if (policy.status === "expired")
    return "Coverage complete · Outcome did not happen";
  return "Active · Watching for your outcome";
}
