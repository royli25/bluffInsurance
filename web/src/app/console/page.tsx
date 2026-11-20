import Link from "next/link";
import Stat from "@/components/Stat";
import StatusPill from "@/components/StatusPill";
import { getCatalog } from "@/lib/service";
import { db } from "@/lib/store";
import { usd, short } from "@/lib/format";
import { PolicyMarks } from "@/components/TeamMarks";
import StreamMonitor from "@/components/StreamMonitor";
import AutoRefresh from "@/components/AutoRefresh";
import { streamHealth } from "@/lib/quicknode/health";

export const dynamic = "force-dynamic";

export default async function Overview() {
  const { universe, catalog } = await getCatalog();
  const ps = db.policies();
  const streams = streamHealth();
  const contracts = universe.events.reduce((s, e) => s + e.contracts.length, 0);
  const premium = ps.reduce((s, p) => s + p.premium, 0);
  const active = ps.filter((p) =>
    ["pending", "active", "settling"].includes(p.status),
  );
  const liability = active.reduce((s, p) => s + p.payout, 0);
  const hedged = active.reduce(
    (s, p) =>
      s +
      (p.hedgeType === "full"
        ? Number(p.hedge.filledQuantity)
        : p.payout * 0.35),
    0,
  );
  // full hedges: order cost is spent; partial (proxy) hedges: capital is recycled, expected loss is the cost
  const hedgeCost = ps
    .filter((p) => p.hedgeType === "full")
    .reduce((s, p) => s + p.hedge.cost, 0);
  const expectedProxyLoss = ps
    .filter((p) => p.hedgeType === "partial")
    .reduce((s, p) => s + p.payout * 0.08, 0);
  const margin = premium - hedgeCost - expectedProxyLoss;
  const paid = ps
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.payout, 0);
  return (
    <div className="space-y-6">
      <AutoRefresh enabled={streams.enabled} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Overview</h1>
        <Link
          href="/console/events"
          className="rounded-md bg-neutral-100 px-4 py-2 font-semibold text-neutral-950 hover:bg-white"
        >
          Drop an event
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Gemini markets"
          value={universe.events.length.toLocaleString()}
        />
        <Stat label="Contracts indexed" value={contracts.toLocaleString()} />
        <Stat label="Protectable events" value={String(catalog.length)} />
        <Stat label="Policies sold" value={String(ps.length)} />
        <Stat label="Premium written" value={usd(premium)} />
        <Stat label="Open liability" value={usd(liability)} />
        <Stat
          label="Hedge coverage"
          value={
            liability
              ? `${Math.min(100, Math.round((hedged / liability) * 100))}%`
              : "—"
          }
        />
        <Stat
          label="Gross margin"
          value={usd(margin)}
          tone={margin >= 0 ? "good" : "warn"}
        />
      </div>

      <StreamMonitor initial={streams} compact />
      <div className="rounded-lg bg-neutral-900 p-4">
        <div className="mb-3 font-semibold">Pipeline</div>
        <div className="grid gap-2 sm:grid-cols-5">
          {[
            ["Event dropped", "Organizer or platform"],
            [
              "Gemini scan",
              `${universe.events.length} markets, ${universe.source}`,
            ],
            ["Coverage match", "Moneyline, spread, total, weather"],
            ["Hedge order", "Buy yes or no at the ask"],
            ["Arc vault", "USDC escrow, automatic refund"],
          ].map(([a, b]) => (
            <div key={a} className="rounded-md bg-neutral-800 p-3">
              <div className="font-semibold">{a}</div>
              <div className="text-neutral-400">{b}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-neutral-900">
        <div className="flex justify-between px-4 py-3">
          <span className="font-semibold">Recent policies</span>
          <span className="text-neutral-400">Refunds paid {usd(paid)}</span>
        </div>
        {ps.length === 0 && (
          <div className="px-4 pb-4 text-neutral-500">
            No policies yet. Buy one on the storefront.
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody>
              {ps.slice(0, 8).map((p) => (
                <tr key={p.id} className="border-t border-neutral-800">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <PolicyMarks eventId={p.eventId} />
                      <div>
                        {p.emoji} {p.coverageName}
                        <div className="text-neutral-400">{p.eventTitle}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {usd(p.premium)}
                    <div className="text-neutral-400">pays {usd(p.payout)}</div>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {p.hedge.order.side} {p.hedge.order.quantity}{" "}
                    {p.hedge.order.outcome} @ {p.hedge.order.price}
                    <div className="text-neutral-400">
                      {p.hedge.order.symbol}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-neutral-400">
                    {p.arc.txHash ? short(p.arc.txHash) : "Awaiting Arc"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StatusPill s={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
