import { db } from "@/lib/store";
import { usd, short } from "@/lib/format";
import StatusPill from "@/components/StatusPill";
import { PolicyMarks } from "@/components/TeamMarks";
import AutoRefresh from "@/components/AutoRefresh";
import { streamConfig } from "@/lib/quicknode/config";

export const dynamic = "force-dynamic";

export default function Policies() {
  const ps = db.policies();
  return (
    <div className="space-y-4">
      <AutoRefresh enabled={streamConfig().enabled} />
      <h1 className="text-xl font-semibold">Policies and hedges</h1>
      {ps.length === 0 && (
        <div className="text-neutral-500">No policies yet.</div>
      )}
      {ps.map((p) => (
        <div key={p.id} className="rounded-lg bg-neutral-900 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <PolicyMarks eventId={p.eventId} />
            <span className="font-semibold">
              {p.emoji} {p.coverageName}
            </span>
            <span className="text-neutral-400">{p.eventTitle}</span>
            <span className="ml-auto">
              <StatusPill s={p.status} />
            </span>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="space-y-1 rounded-md bg-neutral-800 p-3">
              <div className="font-semibold">Policy</div>
              <div className="text-neutral-300">If {p.trigger}</div>
              <div className="text-neutral-300">
                {usd(p.premium)} premium, {usd(p.payout)} payout
              </div>
              <div className="text-neutral-400">
                {p.holderName}, {p.qty} × {p.tierName}
              </div>
            </div>
            <div className="space-y-1 rounded-md bg-neutral-800 p-3">
              <div className="font-semibold">Gemini hedge, {p.hedge.mode}</div>
              <pre className="overflow-x-auto font-mono text-neutral-300">
                {JSON.stringify(p.hedge.order, null, 1)}
              </pre>
              <div className="text-neutral-400">
                {p.hedge.status}, cost {usd(p.hedge.cost)}
              </div>
            </div>
            <div className="space-y-1 rounded-md bg-neutral-800 p-3">
              <div className="font-semibold">Arc vault, {p.arc.mode}</div>
              {p.arc.txHash ? (
                <a
                  href={p.arc.mode === "live" ? p.arc.explorerUrl : undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="block font-mono text-neutral-300 hover:text-white"
                >
                  purchasePolicy {short(p.arc.txHash, 8)}
                </a>
              ) : (
                <div className="text-amber-300">
                  Awaiting purchase confirmation
                </div>
              )}
              <div className="font-mono text-neutral-400">
                policy {short(p.arc.policyIdHex ?? "", 8)}
              </div>
              {p.settlement && (
                <a
                  href={
                    p.settlement.arc.mode === "live"
                      ? p.settlement.arc.explorerUrl
                      : undefined
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="block font-mono text-neutral-300 hover:text-white"
                >
                  settleMarket({String(p.settlement.triggered)}){" "}
                  {short(p.settlement.arc.txHash ?? "", 8)}
                </a>
              )}
              {p.status === "paid" && (
                <div className="text-emerald-400">
                  Payout confirmed for {usd(p.payout)} coverage
                </div>
              )}
              {p.status === "settling" && (
                <div className="text-amber-300">
                  Awaiting settlement confirmation
                </div>
              )}
              {p.chain && (
                <div className="text-xs text-emerald-400">
                  Independently confirmed via QuickNode Streams
                </div>
              )}
              {(p.purchaseError || p.settlementError) && (
                <div className="text-xs text-amber-300">
                  {p.purchaseError || p.settlementError}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
