import ContractLedger from "@/components/ContractLedger";
import AutoRefresh from "@/components/AutoRefresh";
import { db } from "@/lib/store";
import { filterContracts } from "@/lib/business";
export const dynamic = "force-dynamic";
export default async function Contracts({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; event?: string }>;
}) {
  const search = await searchParams;
  const policies = filterContracts(
    db.policies(),
    search.q,
    search.status,
    search.event,
  );
  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <AutoRefresh enabled />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Contracts</h1>
        <p className="mt-2 text-sm text-neutral-500">
          The complete ledger of customer protection.
        </p>
      </header>
      <section className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
        <form
          action="/console/contracts"
          className="flex flex-wrap items-center gap-3 border-b border-neutral-800 p-5"
        >
          <label className="min-w-52 flex-1">
            <span className="sr-only">Search contracts</span>
            <input
              name="q"
              defaultValue={search.q}
              placeholder="Search by event, customer or contract ID"
              className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm outline-none focus:border-neutral-500"
            />
          </label>
          <label>
            <span className="sr-only">Contract status</span>
            <select
              name="status"
              defaultValue={search.status ?? "all"}
              className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="settling">Settling</option>
              <option value="paid">Paid out</option>
              <option value="expired">Completed</option>
            </select>
          </label>
          {search.event && (
            <input type="hidden" name="event" value={search.event} />
          )}
          <button className="rounded-md bg-neutral-800 px-4 py-2.5 text-sm hover:bg-neutral-700">
            Filter
          </button>
          <span className="ml-auto text-xs text-neutral-600">
            {policies.length} {policies.length === 1 ? "contract" : "contracts"}
          </span>
        </form>
        <ContractLedger
          policies={policies}
          empty="No contracts match these filters. Try another search or choose an event to start a purchase."
        />
      </section>
    </div>
  );
}
