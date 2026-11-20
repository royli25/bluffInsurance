import SeatwiseHeader from "@/components/SeatwiseHeader";
import { db } from "@/lib/store";
import { dateParts, usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Account({ searchParams }: { searchParams: Promise<{ new?: string; order?: string }> }) {
  const sp = await searchParams;
  const policies = db.policies();
  const fresh = policies.find((p) => p.id === sp.new);
  return (
    <div className="min-h-screen bg-zinc-100">
      <SeatwiseHeader />
      <main className="mx-auto max-w-4xl px-4 py-6">
        {(fresh || sp.order) && (
          <div className="mb-5 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
            <div className="text-lg font-black text-emerald-800">✅ You&apos;re going! Order confirmed.</div>
            {fresh && (
              <div className="mt-1 text-sm text-emerald-900">
                {fresh.emoji} <b>{fresh.coverageName}</b> is active: if <b>{fresh.trigger}</b>, we send you <b>{usd(fresh.payout)}</b> automatically. Nothing to file.
              </div>
            )}
          </div>
        )}
        <h1 className="mb-3 text-2xl font-black">My Tickets</h1>
        {policies.length === 0 && <div className="rounded-lg bg-white p-6 text-zinc-500">No protected orders yet.</div>}
        <div className="space-y-3">
          {policies.map((p) => {
            const d = dateParts(p.eventStart);
            return (
              <div key={p.id} className="overflow-hidden rounded-lg bg-white shadow-sm">
                <div className="flex gap-4 p-4">
                  <div className="w-14 shrink-0 text-center">
                    <div className="text-xs font-bold text-zinc-500">{d.mon}</div>
                    <div className="text-2xl font-black leading-none">{d.day}</div>
                  </div>
                  <div className="flex-1">
                    <div className="font-bold">{p.eventTitle}</div>
                    <div className="text-sm text-zinc-600">{d.long} · {p.venue}</div>
                    <div className="text-sm text-zinc-600">{p.qty} × {p.tierName} · {usd(p.ticketTotal)}</div>
                  </div>
                  <div className="text-right text-xs text-zinc-500">Order<br /><span className="font-mono">{p.id.replace("pol_", "SW-").toUpperCase()}</span></div>
                </div>
                <div className={`flex flex-wrap items-center gap-3 border-t px-4 py-3 text-sm ${p.status === "paid" ? "bg-emerald-600 text-white" : p.status === "expired" ? "bg-zinc-50 text-zinc-600" : "bg-emerald-50 text-emerald-900"}`}>
                  <span className="font-bold">{p.emoji} {p.coverageName}</span>
                  <span>If {p.trigger} → {usd(p.payout)} back</span>
                  <span className="ml-auto font-semibold">
                    {p.status === "active" && "🟢 Active — watching the game"}
                    {p.status === "expired" && "Didn't trigger — enjoy the win!"}
                    {p.status === "paid" && `💸 Refund sent: ${usd(p.payout)}`}
                  </span>
                </div>
                {p.status === "paid" && (
                  <div className="bg-emerald-700 px-4 py-2 text-xs text-emerald-100">
                    Refund issued {p.settledAt && new Date(p.settledAt).toLocaleString("en-US", { timeZone: "America/Chicago" })} to Visa •••• 4242 · settled in USDC on Arc
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
