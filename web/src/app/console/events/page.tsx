import Link from "next/link";
import DropEvent from "@/components/DropEvent";
import { getCatalog } from "@/lib/service";
import { buildCoverages } from "@/lib/coverage";
import { db } from "@/lib/store";
import { dateParts, usd } from "@/lib/format";
import { EventMarks } from "@/components/TeamMarks";
import AutoRefresh from "@/components/AutoRefresh";
export const dynamic = "force-dynamic";
export default async function Events({
  searchParams,
}: {
  searchParams: Promise<{ add?: string; q?: string }>;
}) {
  const search = await searchParams;
  const { universe, catalog } = await getCatalog();
  const offers = db.offers();
  const policies = db.policies();
  const managed = catalog.filter(
    (e) => offers[e.id] || e.custom || policies.some((p) => p.eventId === e.id),
  );
  const adding = search.add === "1" || managed.length === 0;
  const query = (search.q ?? "").trim().toLowerCase();
  const choices = catalog
    .filter(
      (e) =>
        (!query ||
          `${e.title} ${e.venue} ${e.league}`.toLowerCase().includes(query)) &&
        buildCoverages(universe, e).length > 0,
    )
    .sort(
      (a, b) =>
        Number(b.id.includes("por-nyk")) - Number(a.id.includes("por-nyk")),
    )
    .slice(0, 8);
  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <AutoRefresh enabled />
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Events</h1>
        </div>
        {!adding && (
          <Link
            href="/console/events?add=1"
            className="rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950"
          >
            Add event
          </Link>
        )}
      </header>
      {adding && (
        <section className="rounded-lg bg-neutral-900 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Choose an event to protect</h2>
            </div>
            {managed.length > 0 && (
              <Link href="/console/events" className="text-xs text-neutral-500">
                Close
              </Link>
            )}
          </div>
          <form className="my-5 flex gap-2">
            <input type="hidden" name="add" value="1" />
            <label className="min-w-0 flex-1">
              <span className="sr-only">Search events</span>
              <input
                name="q"
                defaultValue={search.q}
                placeholder="Search teams, artists or venues"
                className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm focus:border-neutral-500 focus:outline-none"
              />
            </label>
            <button className="rounded-md bg-neutral-800 px-4 text-sm hover:bg-neutral-700">
              Search
            </button>
          </form>
          <div className="grid gap-3 lg:grid-cols-2">
            {choices.map((ev) => (
              <Link
                key={ev.id}
                href={`/console/events/${ev.id}`}
                className="flex items-center gap-4 rounded-lg bg-neutral-800/50 p-4 hover:bg-neutral-800"
              >
                <EventMarks ev={ev} />
                <div className="min-w-0">
                  <h3 className="text-sm">{ev.title}</h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    {ev.league} · {dateParts(ev.startTime).long}
                  </p>
                </div>
                <span className="ml-auto text-neutral-500">→</span>
              </Link>
            ))}
          </div>
          {!choices.length && (
            <p className="py-6 text-sm text-neutral-500">
              No matching events. Try another team or city.
            </p>
          )}
          <details className="mt-6 border-t border-neutral-800 pt-4">
            <summary className="cursor-pointer text-xs text-neutral-500">
              Find a different event in Gemini
            </summary>
            <div className="mt-4">
              <DropEvent />
            </div>
          </details>
        </section>
      )}
      {managed.length > 0 && (
        <section className="overflow-hidden rounded-lg bg-neutral-900">
          <div className="px-5 py-5 font-semibold">
            Your events{" "}
            <span className="ml-2 text-xs font-normal text-neutral-600">
              {managed.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="border-y border-neutral-800 text-xs text-neutral-600">
                <tr>
                  {["Event", "Contracts", "Premiums", "Protection", ""].map(
                    (l, i) => (
                      <th key={i} className="px-5 py-3 font-normal">
                        {l}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {managed.map((ev) => {
                  const ps = policies.filter((p) => p.eventId === ev.id);
                  return (
                    <tr
                      key={ev.id}
                      className="border-b border-neutral-800 last:border-0"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/console/events/${ev.id}`}
                          className="hover:underline"
                        >
                          {ev.title}
                        </Link>
                        <p className="mt-1 text-xs text-neutral-600">
                          {dateParts(ev.startTime).long}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {ps.length}
                        <span className="ml-2 text-xs text-neutral-600">
                          {ps.filter((p) => p.status === "active").length}{" "}
                          active
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs">
                        {usd(
                          ps
                            .filter((p) => p.status !== "pending")
                            .reduce((s, p) => s + p.premium, 0),
                        )}
                      </td>
                      <td
                        className={`px-5 py-4 text-xs ${offers[ev.id]?.published ? "text-emerald-300" : "text-neutral-600"}`}
                      >
                        {offers[ev.id]?.published ? "Published" : "Draft"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/console/events/${ev.id}`}
                          className="text-xs text-neutral-400 hover:text-white"
                        >
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
