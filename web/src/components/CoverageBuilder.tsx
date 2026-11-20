"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TicketEvent } from "@/lib/catalog";
import { quote, type Coverage } from "@/lib/coverage";
import type { OfferConfig } from "@/lib/store";
import { usd, pct } from "@/lib/format";

export default function CoverageBuilder({ ev, coverages, initial }: { ev: TicketEvent; coverages: Coverage[]; initial: OfferConfig }) {
  const router = useRouter();
  const [cfg, setCfg] = useState(initial.coverages);
  const [published, setPublished] = useState(initial.published);
  const [tierId, setTierId] = useState(ev.tiers[1]?.id ?? ev.tiers[0].id);
  const [saved, setSaved] = useState("");
  const tier = ev.tiers.find((t) => t.id === tierId)!;

  async function save(pub: boolean) {
    setPublished(pub);
    await fetch("/api/offers", { method: "POST", body: JSON.stringify({ eventId: ev.id, published: pub, coverages: cfg }) });
    setSaved(pub ? "Published to checkout" : "Unpublished");
    router.refresh();
  }

  return (
    <section className="rounded-lg bg-neutral-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base">Coverage builder</h2>
        <select value={tierId} onChange={(e) => setTierId(e.target.value)} className="rounded-md bg-neutral-800 px-2 py-1.5 text-neutral-200">
          {ev.tiers.map((t) => <option key={t.id} value={t.id}>{t.name}, {usd(t.price)}</option>)}
        </select>
      </div>
      {coverages.length === 0 && <div className="mt-3 text-amber-300">No Gemini markets can hedge this event yet.</div>}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {coverages.map((c) => {
          const st = cfg[c.id] ?? { enabled: true, refundPct: c.defaultRefundPct };
          const q = quote(c, tier.price, st.refundPct);
          const set = (patch: Partial<typeof st>) => setCfg({ ...cfg, [c.id]: { ...st, ...patch } });
          return (
            <div key={c.id} className={`rounded-md bg-neutral-800 p-4 ${st.enabled ? "" : "opacity-40"}`}>
              <div className="flex items-start gap-3">
                <div className="text-xl">{c.emoji}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{c.name}</span>
                    <span className={c.hedgeType === "full" ? "text-emerald-400" : "text-amber-300"}>{c.hedgeType === "full" ? "Fully hedged" : "Partial hedge"}</span>
                  </div>
                  <div className="text-neutral-400">If {c.trigger}, {pct(c.probability)} implied</div>
                </div>
                <button onClick={() => set({ enabled: !st.enabled })} aria-label="toggle" className={`h-6 w-11 rounded-full p-0.5 transition ${st.enabled ? "bg-neutral-100" : "bg-neutral-600"}`}>
                  <span className={`block h-5 w-5 rounded-full transition ${st.enabled ? "translate-x-5 bg-neutral-900" : "bg-neutral-300"}`} />
                </button>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span className="w-24 text-neutral-300">Refund {st.refundPct}%</span>
                <input type="range" min={10} max={100} step={5} value={st.refundPct} onChange={(e) => set({ refundPct: Number(e.target.value) })} className="flex-1 accent-neutral-200" />
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {[
                  ["Payout", usd(q.payout)],
                  [c.hedgeType === "full" ? "Hedge cost" : "Hedge capital", usd(q.hedgeCost)],
                  ["Fan pays", usd(q.premium)],
                  ["Margin", usd(q.margin)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-md bg-neutral-700/60 p-2">
                    <div className="text-neutral-400">{k}</div>
                    <div className="font-semibold">{v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-md bg-neutral-900 p-3 font-mono text-neutral-300">
                <div>Buy {q.contracts.toFixed(2)} {c.hedge.outcome} @ {c.hedge.price.toFixed(2)}{c.hedge.indicative ? ", indicative" : ""}</div>
                <div className="text-neutral-400">{c.hedge.instrumentSymbol}</div>
              </div>
              {c.basisNote && <div className="mt-3 text-neutral-400">Hedge capital is recycled after the injury report. {c.basisNote}</div>}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={() => save(true)} className="rounded-md bg-neutral-100 px-4 py-2 font-semibold text-neutral-950 hover:bg-white">Publish to checkout</button>
        {published && <button onClick={() => save(false)} className="rounded-md bg-neutral-800 px-4 py-2 text-neutral-200 hover:bg-neutral-700">Unpublish</button>}
        <a href={`/seatwise/event/${ev.id}`} className="text-neutral-300 hover:text-white">Preview on storefront</a>
        {saved && <span className="text-emerald-400">{saved}</span>}
      </div>
    </section>
  );
}
