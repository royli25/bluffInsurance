import Link from "next/link";
import Stat from "@/components/Stat";
import StatusPill from "@/components/StatusPill";
import { getCatalog } from "@/lib/service";
import { db } from "@/lib/store";
import { usd, short } from "@/lib/format";
import { hedgeMode } from "@/lib/gemini/trading";
import { arcMode } from "@/lib/arc/client";

export const dynamic = "force-dynamic";

export default async function Overview() {
  const { universe, catalog } = await getCatalog();
  const ps = db.policies();
  const contracts = universe.events.reduce((s, e) => s + e.contracts.length, 0);
  const liquid = universe.events.reduce((s, e) => s + e.contracts.filter((c) => c.prices?.buy?.yes || c.prices?.buy?.no).length, 0);
  const premium = ps.reduce((s, p) => s + p.premium, 0);
  const active = ps.filter((p) => p.status === "active");
  const liability = active.reduce((s, p) => s + p.payout, 0);
  const hedged = active.reduce((s, p) => s + (p.hedgeType === "full" ? Number(p.hedge.filledQuantity) : p.payout * 0.35), 0);
  // full hedges: order cost is spent; partial (proxy) hedges: capital is recycled, expected loss is the cost
  const hedgeCost = ps.filter((p) => p.hedgeType === "full").reduce((s, p) => s + p.hedge.cost, 0);
  const proxyCapital = ps.filter((p) => p.hedgeType === "partial").reduce((s, p) => s + p.hedge.cost, 0);
  const expectedProxyLoss = ps.filter((p) => p.hedgeType === "partial").reduce((s, p) => s + p.payout * 0.08, 0);
  const margin = premium - hedgeCost - expectedProxyLoss;
  const paid = ps.filter((p) => p.status === "paid").reduce((s, p) => s + p.payout, 0);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-zinc-500">Gemini data: <span className="text-emerald-400">{universe.source}</span> · fetched {new Date(universe.fetchedAt).toLocaleTimeString("en-US", { timeZone: "America/Chicago" })} CT · orders {hedgeMode()} · Arc {arcMode()}</p>
        </div>
        <Link href="/console/events" className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-400">+ Drop an event</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Markets scanned" value={universe.events.length.toLocaleString()} sub={`${contracts.toLocaleString()} contracts · ${liquid.toLocaleString()} quoted`} />
        <Stat label="Protectable events" value={String(catalog.length)} sub="games + outdoor shows with a hedge" />
        <Stat label="Policies sold" value={String(ps.length)} sub={`${active.length} active`} />
        <Stat label="Premium written" value={usd(premium)} sub={`full-hedge spend ${usd(hedgeCost)} · proxy capital ${usd(proxyCapital)}`} tone="good" />
        <Stat label="Open liability" value={usd(liability)} sub="max refunds owed" />
        <Stat label="Hedge coverage" value={liability ? `${Math.min(100, Math.round((hedged / liability) * 100))}%` : "—"} sub="payout backed by Gemini contracts" tone="good" />
        <Stat label="Refunds paid" value={usd(paid)} sub="via Arc vault" />
        <Stat label="Gross margin" value={usd(margin)} sub="premium − hedge cost − expected proxy loss" tone={margin >= 0 ? "good" : "warn"} />
      </div>

      <div className="rounded-xl border border-zinc-800 p-4">
        <div className="mb-3 text-sm font-semibold text-zinc-400">Pipeline</div>
        <div className="grid gap-2 text-sm sm:grid-cols-5">
          {[
            ["Event dropped", "organizer / platform"],
            ["Gemini scan", `${universe.events.length} markets`],
            ["Coverage match", "team · spread · total · props · weather"],
            ["Hedge order", "buy YES/NO at ask"],
            ["Arc vault", "USDC escrow → auto refund"],
          ].map(([a, b], i) => (
            <div key={a} className="rounded-lg bg-zinc-900 p-3">
              <div className="font-mono text-xs text-emerald-400">0{i + 1}</div>
              <div className="font-semibold">{a}</div>
              <div className="text-xs text-zinc-500">{b}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800">
        <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-400">Recent policies</div>
        {ps.length === 0 && <div className="p-4 text-sm text-zinc-500">No policies yet — buy one on the Seatwise storefront.</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {ps.slice(0, 8).map((p) => (
                <tr key={p.id} className="border-b border-zinc-900">
                  <td className="px-4 py-2 font-mono text-xs text-zinc-500">{p.id}</td>
                  <td className="px-4 py-2">{p.emoji} {p.coverageName}<div className="text-xs text-zinc-500">{p.eventTitle}</div></td>
                  <td className="px-4 py-2 text-right">{usd(p.premium)}<div className="text-xs text-zinc-500">pays {usd(p.payout)}</div></td>
                  <td className="px-4 py-2 font-mono text-xs">{p.hedge.order.side} {p.hedge.order.quantity} {p.hedge.order.outcome.toUpperCase()} @ {p.hedge.order.price}<div className="text-zinc-500">{p.hedge.order.symbol}</div></td>
                  <td className="px-4 py-2 font-mono text-xs text-zinc-500">{short(p.arc.txHash)}</td>
                  <td className="px-4 py-2"><StatusPill s={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
