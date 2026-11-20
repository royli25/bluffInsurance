import Link from "next/link";
import { db } from "@/lib/store";
import { businessSummary } from "@/lib/business";
import { usd } from "@/lib/format";
import ManagedCoverageMarkets from "@/components/ManagedCoverageMarkets";
import AutoRefresh from "@/components/AutoRefresh";
import ContractLedger from "@/components/ContractLedger";
export const dynamic = "force-dynamic";
export default function Dashboard() {
  const policies = db.policies();
  const summary = businessSummary(policies);
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AutoRefresh enabled />
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Link
          href="/console/events?add=1"
          className="rounded-md bg-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-white"
        >
          Add event
        </Link>
      </header>
      <section
        className="grid gap-3 sm:grid-cols-3"
        aria-label="Business totals"
      >
        {[
          ["Active contracts", summary.active.toLocaleString(), "active"],
          [
            "Protected events",
            summary.protectedEvents.toLocaleString(),
            "events",
          ],
          ["Premiums collected", usd(summary.premiums), "premiums"],
        ].map(([label, value, key]) => (
          <div key={key} className="rounded-lg bg-neutral-900 p-5">
            <h2 className="text-sm font-normal text-neutral-400">{label}</h2>
            <div
              data-metric={key}
              className="mt-3 text-3xl font-semibold tabular-nums"
            >
              {value}
            </div>
          </div>
        ))}
      </section>
      <ManagedCoverageMarkets />
      <section className="overflow-hidden rounded-lg bg-neutral-900">
        <div className="flex items-center justify-between gap-3 px-5 py-5">
          <h2 className="font-semibold">Recent contracts</h2>
          <Link
            href="/console/contracts"
            className="text-xs text-neutral-400 hover:text-white"
          >
            View all →
          </Link>
        </div>
        <ContractLedger policies={policies.slice(0, 8)} />
      </section>
      {summary.pending > 0 && (
        <p className="text-xs text-amber-300">
          {summary.pending} awaiting confirmation.{" "}
          <Link href="/console/contracts" className="underline">
            View contracts
          </Link>
        </p>
      )}
    </div>
  );
}
