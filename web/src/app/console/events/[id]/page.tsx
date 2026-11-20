import Link from "next/link";
import { notFound } from "next/navigation";
import CoverageBuilder from "@/components/CoverageBuilder";
import SettlementPanel from "@/components/SettlementPanel";
import ContractLedger from "@/components/ContractLedger";
import DemoSteps from "@/components/DemoSteps";
import { getEvent, defaultOffer } from "@/lib/service";
import { buildCoverages, relatedMarkets } from "@/lib/coverage";
import { db } from "@/lib/store";
import { dateParts } from "@/lib/format";
import { EventMarks } from "@/components/TeamMarks";
import AutoRefresh from "@/components/AutoRefresh";
export const dynamic = "force-dynamic";
export default async function EventConfig({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { universe, ev } = await getEvent(id);
  if (!ev) notFound();
  const covs = buildCoverages(universe, ev, "home");
  const offer = db.offer(id) ?? { ...defaultOffer(id, covs), published: false };
  const policies = db.policies().filter((p) => p.eventId === id);
  const demo = policies.filter((p) => p.arc.mode === "simulated");
  const markets = relatedMarkets(universe, ev);
  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <AutoRefresh enabled />
      <header>
        <Link
          href="/console/events"
          className="text-xs text-neutral-500 hover:text-white"
        >
          ← Events
        </Link>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <EventMarks ev={ev} large />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{ev.title}</h1>
            <p className="mt-2 text-sm text-neutral-500">
              {dateParts(ev.startTime).long} · {ev.venue}
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1.5 text-xs ${offer.published ? "border-emerald-900 text-emerald-300" : "border-neutral-800 text-neutral-500"}`}
          >
            {offer.published ? "Protection published" : "Draft"}
          </span>
        </div>
      </header>
      <DemoSteps
        eventId={id}
        published={offer.published}
        purchased={policies.length > 0}
        resolved={
          policies.length > 0 &&
          policies.every((p) => p.status === "paid" || p.status === "expired")
        }
      />
      <div id="protection" className="scroll-mt-6">
        <CoverageBuilder ev={ev} coverages={covs} initial={offer} />
      </div>
      <div id="resolve" className="scroll-mt-6">
        <SettlementPanel
          eventId={id}
          coverages={covs.map((c) => ({
            id: c.id,
            name: c.name,
            emoji: c.emoji,
            trigger: c.trigger,
          }))}
          counts={Object.fromEntries(
            covs.map((c) => [
              c.id,
              demo.filter((p) => p.coverageId === c.id && p.status === "active")
                .length,
            ]),
          )}
        />
      </div>
      <section className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/40">
        <div className="flex items-center justify-between gap-3 px-5 py-5">
          <h2 className="font-semibold">Event contracts</h2>
          <Link
            className="text-xs text-neutral-500 hover:text-white"
            href={`/console/contracts?event=${id}`}
          >
            View ledger →
          </Link>
        </div>
        <ContractLedger policies={policies} />
      </section>
      <details className="rounded-lg border border-neutral-800 p-5 text-xs text-neutral-500">
        <summary className="cursor-pointer">
          Matching prediction markets · {markets.length}
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {markets.map((m) => (
            <div key={m.ticker} className="rounded-md bg-neutral-900 p-3">
              <p className="text-neutral-300">{m.title}</p>
              <p className="mt-2 break-all font-mono text-xs text-neutral-600">
                {m.ticker}
              </p>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
