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
      <h1 className="text-2xl font-bold">Events</h1>
      <DropEvent />
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-zinc-500">
            <tr className="border-b border-zinc-800"><th className="px-4 py-2">Event</th><th className="px-4 py-2">When</th><th className="px-4 py-2">Gemini markets</th><th className="px-4 py-2">Coverages</th><th className="px-4 py-2">Checkout</th><th /></tr>
          </thead>
          <tbody>
            {rows.map(({ ev, markets, covs, published }) => (
              <tr key={ev.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                <td className="px-4 py-2">
                  <div className="font-medium">{ev.custom && <span className="mr-1 rounded bg-emerald-500/20 px-1.5 text-[10px] text-emerald-300">NEW</span>}{ev.title}</div>
                  <div className="text-xs text-zinc-500">{ev.league} · {ev.venue}</div>
                </td>
                <td className="px-4 py-2 text-zinc-400">{dateParts(ev.startTime).long}</td>
                <td className="px-4 py-2">{markets}</td>
                <td className="px-4 py-2">{covs}</td>
                <td className="px-4 py-2">{published && covs ? <span className="text-emerald-400">● live</span> : <span className="text-zinc-500">off</span>}</td>
                <td className="px-4 py-2 text-right"><Link className="text-emerald-400 hover:underline" href={`/console/events/${ev.id}`}>Configure →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
