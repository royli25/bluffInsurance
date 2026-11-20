"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TicketEvent } from "@/lib/catalog";
import { quote, PRICING, type Coverage } from "@/lib/coverage";
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
    setSaved(pub ? "Published to Seatwise checkout ✓" : "Unpublished");
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-zinc-800 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">② Coverage builder <span className="text-xs font-normal text-zinc-500">· priced live off Gemini asks · margin {Math.round(PRICING.margin * 100)}% + {usd(PRICING.fee)} fee</span></h2>
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          Sample ticket
          <select value={tierId} onChange={(e) => setTierId(e.target.value)} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200">
            {ev.tiers.map((t) => <option key={t.id} value={t.id}>{t.name} · {usd(t.price)}</option>)}
          </select>
        </label>
      </div>
      {coverages.length === 0 && <div className="mt-3 text-sm text-amber-300">No liquid Gemini markets match this event yet — nothing hedgeable to offer.</div>}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {coverages.map((c) => {
          const st = cfg[c.id] ?? { enabled: true, refundPct: c.defaultRefundPct };
          const q = quote(c, tier.price, st.refundPct);
          const set = (patch: Partial<typeof st>) => setCfg({ ...cfg, [c.id]: { ...st, ...patch } });
          return (
            <div key={c.id} className={`rounded-xl border p-4 ${st.enabled ? "border-zinc-700 bg-zinc-900/60" : "border-zinc-900 opacity-50"}`}>
              <div className="flex items-start gap-3">
                <div className="text-2xl">{c.emoji}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{c.name}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${c.hedgeType === "full" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{c.hedgeType === "full" ? "fully hedged" : "partial hedge"}</span>
                  </div>
                  <div className="text-sm text-zinc-400">Trigger: <b className="text-zinc-200">{c.trigger}</b> · implied {pct(c.probability)}</div>
                </div>
                <button onClick={() => set({ enabled: !st.enabled })} className={`h-6 w-11 rounded-full p-0.5 transition ${st.enabled ? "bg-emerald-500" : "bg-zinc-700"}`}>
                  <span className={`block h-5 w-5 rounded-full bg-white transition ${st.enabled ? "translate-x-5" : ""}`} />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3 text-sm">
                <span className="w-24 text-zinc-400">Refund {st.refundPct}%</span>
                <input type="range" min={10} max={100} step={5} value={st.refundPct} onChange={(e) => set({ refundPct: Number(e.target.value) })} className="flex-1 accent-emerald-500" />
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded bg-zinc-950 p-2"><div className="text-zinc-500">Payout</div><div className="font-semibold">{usd(q.payout)}</div></div>
                <div className="rounded bg-zinc-950 p-2"><div className="text-zinc-500">{c.hedgeType === "full" ? "Hedge cost" : "Hedge capital*"}</div><div className="font-semibold">{usd(q.hedgeCost)}</div></div>
                <div className="rounded bg-zinc-950 p-2"><div className="text-zinc-500">Fan pays</div><div className="font-semibold text-emerald-400">{usd(q.premium)}</div></div>
                <div className="rounded bg-zinc-950 p-2"><div className="text-zinc-500">Margin</div><div className="font-semibold">{usd(q.margin)}</div></div>
              </div>
              <div className="mt-3 rounded-lg bg-zinc-950 p-2.5 font-mono text-[11px] text-zinc-400">
                <div className="text-zinc-500">hedge leg → {c.hedge.indicative ? <span className="text-amber-300">indicative · book not open yet, rests as limit order</span> : <span className="text-emerald-400">live ask</span>}</div>
                BUY {q.contracts.toFixed(2)} × {c.hedge.outcome.toUpperCase()} @ {c.hedge.price.toFixed(2)}
                <div className="text-emerald-300">{c.hedge.instrumentSymbol}</div>
                <div className="font-sans text-zinc-500">{c.hedge.eventTitle} — “{c.hedge.contractLabel}”</div>
              </div>
              {c.basisNote && <div className="mt-2 text-[11px] text-amber-200/80">*Capital, not cost: the position is sold back after the injury report. {c.basisNote}</div>}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={() => save(true)} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-400">Publish to checkout</button>
        {published && <button onClick={() => save(false)} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300">Unpublish</button>}
        <a href={`/seatwise/event/${ev.id}`} className="text-sm text-blue-300 hover:underline">Preview on Seatwise ↗</a>
        {saved && <span className="text-sm text-emerald-400">{saved}</span>}
      </div>
    </section>
  );
}
