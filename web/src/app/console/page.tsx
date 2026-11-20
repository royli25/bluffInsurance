import Link from "next/link";
import { db } from "@/lib/store";
import { businessSummary } from "@/lib/business";
import { usd } from "@/lib/format";
import AutoRefresh from "@/components/AutoRefresh";
import ContractLedger from "@/components/ContractLedger";
export const dynamic = "force-dynamic";
export default function Dashboard() {
  const policies = db.policies();
  const summary = businessSummary(policies);
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <AutoRefresh enabled />
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-xs text-neutral-500">
            YOUR BUSINESS, AT A GLANCE
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Protection sold. Events covered. Everything in one place.
          </p>
        </div>
        <Link
          href="/console/events?add=1"
          className="rounded-md bg-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-white"
        >
          Add event
        </Link>
      </header>
      <section
        className="grid gap-4 sm:grid-cols-3"
        aria-label="Business totals"
      >
        {[
          [
            "Active contracts",
            summary.active.toLocaleString(),
            "Customer protection currently in force",
            "active",
          ],
          [
            "Protected events",
            summary.protectedEvents.toLocaleString(),
            "Events with active customer contracts",
            "events",
          ],
          [
            "Premiums collected",
            usd(summary.premiums),
            "All-time premiums · before hedge costs",
            "premiums",
          ],
        ].map(([label, value, hint, key]) => (
          <div
            key={key}
            className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6"
          >
            <h2 className="text-sm text-neutral-400">{label}</h2>
            <div
              data-metric={key}
              className="mt-4 text-4xl font-semibold tracking-tight tabular-nums"
            >
              {value}
            </div>
            <p className="mt-3 text-xs leading-5 text-neutral-600">{hint}</p>
          </div>
        ))}
      </section>
      {!policies.length && (
        <section className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-neutral-800 px-6 py-5">
          <div>
            <h2 className="font-semibold">
              Your first contract starts with an event.
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Publish protection, try the checkout, then follow it through to a
              payout.
            </p>
          </div>
          <Link
            href="/console/events"
            className="whitespace-nowrap text-sm text-neutral-200 hover:underline"
          >
            Set up protection →
          </Link>
        </section>
      )}
      <section className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
          <div>
            <h2 className="font-semibold">Recent contracts</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Every purchase, from confirmation to payout.
            </p>
          </div>
          <Link
            href="/console/contracts"
            className="text-xs text-neutral-400 hover:text-white"
          >
            View all contracts →
          </Link>
        </div>
        <ContractLedger policies={policies.slice(0, 8)} />
      </section>
      {summary.pending > 0 && (
        <p className="text-xs text-amber-300">
          {summary.pending}{" "}
          {summary.pending === 1 ? "contract is" : "contracts are"} awaiting
          confirmation.{" "}
          <Link className="underline" href="/console/contracts">
            Review contracts
          </Link>
        </p>
      )}
    </div>
  );
}
