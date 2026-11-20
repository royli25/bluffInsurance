import Link from "next/link";
import DropEvent from "@/components/DropEvent";
import { getCatalog } from "@/lib/service";
import { relatedMarkets, buildCoverages } from "@/lib/coverage";
import { db } from "@/lib/store";
import { dateParts } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Events() {
  const { universe, catalog } = await getCatalog();
  const offers = db.offers();
  const rows = catalog.slice(0, 40).map((ev) => ({
    ev,
    markets: relatedMarkets(universe, ev).length,
    covs: buildCoverages(universe, ev).length,
    published: offers[ev.id]?.published ?? true,
  }));
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Events</h1>
      <DropEvent />
      <div className="overflow-x-auto rounded-lg bg-neutral-900">
        <table className="w-full">
          <thead className="text-left text-neutral-400">
            <tr><th className="px-4 py-3 font-normal">Event</th><th className="px-4 py-3 font-normal">When</th><th className="px-4 py-3 font-normal">Markets</th><th className="px-4 py-3 font-normal">Covers</th><th className="px-4 py-3 font-normal">Checkout</th><th /></tr>
          </thead>
          <tbody>
            {rows.map(({ ev, markets, covs, published }) => (
              <tr key={ev.id} className="border-t border-neutral-800 hover:bg-neutral-800/60">
                <td className="px-4 py-3">{ev.title}{ev.custom && <span className="ml-2 rounded-md bg-neutral-700 px-1.5 py-0.5 text-neutral-200">New</span>}</td>
                <td className="px-4 py-3 text-neutral-400">{dateParts(ev.startTime).long}</td>
                <td className="px-4 py-3">{markets}</td>
                <td className="px-4 py-3">{covs}</td>
                <td className="px-4 py-3">{published && covs ? <span className="text-emerald-400">Live</span> : <span className="text-neutral-500">Off</span>}</td>
                <td className="px-4 py-3 text-right"><Link className="text-neutral-300 hover:text-white" href={`/console/events/${ev.id}`}>Configure</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
