import Link from "next/link";
import SeatwiseHeader from "@/components/SeatwiseHeader";
import EventRow from "@/components/EventRow";
import { getCatalog } from "@/lib/service";
import { buildCoverages } from "@/lib/coverage";
import { featured } from "@/lib/catalog";
import { dateParts } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Seatwise() {
  const { catalog, universe } = await getCatalog();
  const feat = featured(catalog);
  // hero = the featured game with the richest live-quoted protection menu
  const score = (e: (typeof catalog)[number]) =>
    buildCoverages(universe, e).reduce((s, c) => s + (c.hedge.indicative ? 0.5 : 1) + (c.id === "star-sits" ? 0.5 : 0), 0);
  const hero = [...feat.filter((e) => e.kind === "sports")].sort((a, b) => score(b) - score(a))[0] ?? feat[0];
  const groups: [string, typeof catalog][] = [
    ["Your events", catalog.filter((e) => e.custom)],
    ["NBA", catalog.filter((e) => e.league === "NBA").slice(0, 6)],
    ["Concerts", catalog.filter((e) => e.kind === "concert")],
    ["NFL", catalog.filter((e) => e.league === "NFL").slice(0, 4)],
    ["NHL", catalog.filter((e) => e.league === "NHL").slice(0, 4)],
    ["College Football", catalog.filter((e) => e.league === "NCAAF").slice(0, 4)],
  ];
  return (
    <div className="min-h-screen bg-white">
      <SeatwiseHeader />
      {hero && (
        <Link href={`/seatwise/event/${hero.id}`} className="block bg-neutral-900">
          <div className="mx-auto max-w-6xl px-4 py-12 text-white">
            <h1 className="mt-2 text-3xl font-semibold ">{hero.title}</h1>
            <div className="mt-2 text-white/80">{dateParts(hero.startTime).long} · {hero.venue}</div>
            <div className="mt-5 inline-flex items-center gap-3">
              <span className="rounded bg-white px-5 py-2.5 font-semibold text-[#024ddf]">Find Tickets</span>
              <span className="text-neutral-300">Bluff Protect available</span>
            </div>
          </div>
        </Link>
      )}
      <main className="mx-auto max-w-6xl px-4 py-8">
        {groups.filter(([, xs]) => xs.length).map(([name, xs]) => (
          <section key={name} className="mb-10">
            <h2 className="mb-1 text-xl font-semibold">{name}</h2>
            {xs.map((ev) => <EventRow key={ev.id} ev={ev} />)}
          </section>
        ))}
      </main>
    </div>
  );
}
