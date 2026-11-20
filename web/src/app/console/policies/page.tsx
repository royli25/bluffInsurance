import { db } from "@/lib/store";
import { usd, short } from "@/lib/format";
import StatusPill from "@/components/StatusPill";

export const dynamic = "force-dynamic";

export default function Policies() {
  const ps = db.policies();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Policies &amp; Hedges</h1>
      {ps.length === 0 && <div className="text-zinc-500">No policies yet.</div>}
      {ps.map((p) => (
        <div key={p.id} className="rounded-xl border border-zinc-800 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-zinc-500">{p.id}</span>
            <span className="font-semibold">{p.emoji} {p.coverageName}</span>
            <span className="text-sm text-zinc-400">{p.eventTitle}</span>
            <span className="ml-auto"><StatusPill s={p.status} /></span>
          </div>
          <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg bg-zinc-900 p-3">
              <div className="text-xs uppercase text-zinc-500">Policy</div>
              <div>Trigger: <b>{p.trigger}</b></div>
              <div>Premium {usd(p.premium)} → payout {usd(p.payout)} ({p.refundPct}% of {usd(p.ticketTotal)})</div>
              <div className="text-xs text-zinc-500">{p.holderName} · {p.qty}× {p.tierName}</div>
            </div>
            <div className="rounded-lg bg-zinc-900 p-3">
              <div className="text-xs uppercase text-zinc-500">Gemini hedge · {p.hedge.mode} · {p.hedgeType}</div>
              <pre className="mt-1 overflow-x-auto text-[11px] text-emerald-300">{`POST /v1/prediction-markets/order\n${JSON.stringify(p.hedge.order, null, 1)}`}</pre>
              <div className="text-xs text-zinc-400">{p.hedge.orderId} · {p.hedge.status} · cost {usd(p.hedge.cost)}</div>
              <div className="text-xs text-zinc-500">{p.hedgeLeg.eventTitle} → {p.hedgeLeg.contractLabel}</div>
            </div>
            <div className="rounded-lg bg-zinc-900 p-3">
              <div className="text-xs uppercase text-zinc-500">Arc vault · {p.arc.mode}</div>
              <div className="font-mono text-xs">purchasePolicy tx {short(p.arc.txHash, 8)}</div>
              <div className="font-mono text-[11px] text-zinc-500">policyId {short(p.arc.policyIdHex ?? "", 8)}</div>
              <div className="font-mono text-[11px] text-zinc-500">marketRef {short(p.arc.marketRefHex ?? "", 8)}</div>
              {p.settlement && (
                <div className="mt-2 text-xs">
                  settleMarket({p.settlement.triggered ? "true" : "false"}) tx <span className="font-mono">{short(p.settlement.arc.txHash, 8)}</span>
                  {p.settlement.triggered && <div className="text-emerald-400">Hedge proceeds {usd(p.settlement.hedgeProceeds)} deposited → {usd(p.payout)} paid to holder</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
