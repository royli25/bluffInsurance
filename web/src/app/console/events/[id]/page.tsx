import Link from "next/link";
import { notFound } from "next/navigation";
import CoverageBuilder from "@/components/CoverageBuilder";
import SettlementPanel from "@/components/SettlementPanel";
import { getEvent, defaultOffer } from "@/lib/service";
import { buildCoverages, relatedMarkets } from "@/lib/coverage";
import { db } from "@/lib/store";
import { dateParts, usd } from "@/lib/format";
import { EventMarks } from "@/components/TeamMarks";
import AutoRefresh from "@/components/AutoRefresh";
import { streamConfig } from "@/lib/quicknode/config";

export const dynamic = "force-dynamic";

export default async function EventConfig({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { universe, ev } = await getEvent(id);
  if (!ev) notFound();
  const markets = relatedMarkets(universe, ev);
  const covs = buildCoverages(universe, ev, "home");
  const offer = db.offer(ev.id) ?? defaultOffer(ev.id, covs);
  const policies = db.policies().filter((p) => p.eventId === ev.id);
  const contracts = markets.reduce((s, m) => s + m.contracts.length, 0);
  const quoted = markets.reduce(
    (s, m) =>
      s +
      m.contracts.filter((c) => c.prices?.buy?.yes || c.prices?.buy?.no).length,
    0,
  );
  return (
    <div className="space-y-6">
      <AutoRefresh enabled={streamConfig().enabled} />
      <div className="space-y-1">
        <Link
          href="/console/events"
          className="text-neutral-400 hover:text-neutral-200"
        >
          ← Events
        </Link>
        <div className="flex items-center gap-4 pt-2">
          <EventMarks ev={ev} large />
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-semibold">{ev.title}</h1>
            <div className="text-neutral-400">
              {dateParts(ev.startTime).long}, {ev.venue}
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-lg bg-neutral-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base">Market scan</h2>
          <div className="text-neutral-400">
            {markets.length} markets, {contracts} contracts, {quoted} quoted,{" "}
            {universe.events.length} scanned
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {markets.slice(0, 18).map((m) => {
            const q = m.contracts.filter(
              (c) => c.prices?.buy?.yes || c.prices?.buy?.no,
            ).length;
            const used = covs.some((c) => c.hedge.eventTicker === m.ticker);
            return (
              <div
                key={m.ticker}
                className={`rounded-md p-3 ${used ? "bg-neutral-700" : "bg-neutral-800"}`}
              >
                <div className="flex justify-between gap-2">
                  <span>
                    {m.title.includes(":")
                      ? m.title.split(":")[1].trim()
                      : m.category === "Weather"
                        ? "Daily high temperature"
                        : "Moneyline"}
                  </span>
                  {used && <span className="text-emerald-400">Hedge</span>}
                </div>
                <div className="font-mono text-neutral-400">{m.ticker}</div>
                <div className="text-neutral-400">
                  {m.contracts.length} contracts, {q} quoted,{" "}
                  {usd(Number(m.volume ?? 0))} volume
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <CoverageBuilder ev={ev} coverages={covs} initial={offer} />

      <SettlementPanel
        eventId={ev.id}
        coverages={covs.map((c) => ({
          id: c.id,
          name: c.name,
          emoji: c.emoji,
          trigger: c.trigger,
        }))}
        counts={Object.fromEntries(
          covs.map((c) => [
            c.id,
            policies.filter(
              (p) => p.coverageId === c.id && p.status === "active",
            ).length,
          ]),
        )}
      />

      <section className="rounded-lg bg-neutral-900">
        <div className="px-4 py-3 text-base">Policies on this event</div>
        {policies.length === 0 && (
          <div className="px-4 pb-4 text-neutral-500">None yet.</div>
        )}
        {policies.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap gap-3 border-t border-neutral-800 px-4 py-3"
          >
            <span>
              {p.emoji} {p.coverageName}
            </span>
            <span className="text-neutral-400">
              {usd(p.premium)} for {usd(p.payout)}
            </span>
            <span className="ml-auto text-neutral-300">{p.status}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
