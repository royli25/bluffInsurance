import Link from "next/link";
import { notFound } from "next/navigation";
import CoverageBuilder from "@/components/CoverageBuilder";
import SettlementPanel from "@/components/SettlementPanel";
import { getEvent, defaultOffer } from "@/lib/service";
import { buildCoverages, relatedMarkets } from "@/lib/coverage";
import { db } from "@/lib/store";
import { dateParts, usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EventConfig({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { universe, ev } = await getEvent(id);
  if (!ev) notFound();
  const markets = relatedMarkets(universe, ev);
  const covs = buildCoverages(universe, ev, "home");
  const offer = db.offer(ev.id) ?? defaultOffer(ev.id, covs);
  const policies = db.policies().filter((p) => p.eventId === ev.id);
  const contracts = markets.reduce((s, m) => s + m.contracts.length, 0);
  const quoted = markets.reduce((s, m) => s + m.contracts.filter((c) => c.prices?.buy?.yes || c.prices?.buy?.no).length, 0);
  return (
    <div className="space-y-6">
      <div>
        <Link href="/console/events" className="text-sm text-zinc-500 hover:text-zinc-300">← Events</Link>
        <h1 className="mt-1 text-2xl font-bold">{ev.title}</h1>
        <div className="text-sm text-zinc-400">{ev.subtitle} · {dateParts(ev.startTime).long} · {ev.venue}, {ev.city}</div>
      </div>

      <section className="rounded-xl border border-zinc-800 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">① Gemini market scan</h2>
          <div className="text-xs text-zinc-500">{markets.length} matching markets · {contracts} contracts · {quoted} with live quotes · scanned {universe.events.length} total</div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {markets.slice(0, 18).map((m) => {
            const q = m.contracts.filter((c) => c.prices?.buy?.yes || c.prices?.buy?.no).length;
            const used = covs.some((c) => c.hedge.eventTicker === m.ticker);
            return (
              <div key={m.ticker} className={`rounded-lg border p-2.5 text-xs ${used ? "border-emerald-500/60 bg-emerald-500/5" : "border-zinc-800 bg-zinc-900/40"}`}>
                <div className="font-medium text-zinc-200">{m.title.includes(":") ? m.title.split(":")[1].trim() : m.category === "Weather" ? m.title : "Moneyline"}</div>
                <div className="font-mono text-[10px] text-zinc-500">{m.ticker}</div>
                <div className="mt-1 text-zinc-400">{m.contracts.length} contracts · {q} quoted · vol {usd(Number(m.volume ?? 0))}{used && <span className="ml-1 text-emerald-400">· used for hedge</span>}</div>
              </div>
            );
          })}
        </div>
        {markets.length > 18 && <div className="mt-2 text-xs text-zinc-500">+ {markets.length - 18} more (quarters, halves, player props)</div>}
      </section>

      <CoverageBuilder ev={ev} coverages={covs} initial={offer} />

      <SettlementPanel eventId={ev.id} coverages={covs.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji, trigger: c.trigger }))}
        counts={Object.fromEntries(covs.map((c) => [c.id, policies.filter((p) => p.coverageId === c.id && p.status === "active").length]))} />

      <section className="rounded-xl border border-zinc-800">
        <div className="border-b border-zinc-800 px-4 py-3 font-semibold">Policies on this event ({policies.length})</div>
        {policies.map((p) => (
          <div key={p.id} className="flex flex-wrap gap-3 border-b border-zinc-900 px-4 py-2 text-sm">
            <span className="font-mono text-xs text-zinc-500">{p.id}</span>
            <span>{p.emoji} {p.coverageName}</span>
            <span className="text-zinc-400">{usd(p.premium)} → {usd(p.payout)}</span>
            <span className="ml-auto text-xs">{p.status}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
