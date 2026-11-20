"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TicketEvent } from "@/lib/catalog";
import { usd0 } from "@/lib/format";

const TIER_COLORS = ["#60a5fa", "#2563eb", "#7c3aed", "#db2777"];

export default function TicketPicker({ ev }: { ev: TicketEvent }) {
  const [tier, setTier] = useState(ev.tiers[1]?.id ?? ev.tiers[0].id);
  const [qty, setQty] = useState(2);
  const router = useRouter();
  const idx = ev.tiers.findIndex((t) => t.id === tier);
  const t = ev.tiers[idx];

  return (
    <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[380px_1fr]">
      <div className="rounded-lg bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="font-bold">Tickets</div>
          <select value={qty} onChange={(e) => setQty(Number(e.target.value))} className="rounded border px-2 py-1 text-sm">
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} Ticket{n > 1 ? "s" : ""}</option>)}
          </select>
        </div>
        {ev.tiers.map((x, i) => (
          <button key={x.id} onClick={() => setTier(x.id)}
            className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left ${tier === x.id ? "bg-blue-50 ring-2 ring-inset ring-[#024ddf]" : "hover:bg-zinc-50"}`}>
            <span className="h-3 w-3 rounded-full" style={{ background: TIER_COLORS[i] }} />
            <div className="flex-1">
              <div className="font-semibold">{x.name}</div>
              <div className="text-xs text-zinc-500">{x.section} · Standard Admission</div>
            </div>
            <div className="text-right">
              <div className="font-bold">{usd0(x.price)}</div>
              <div className="text-[11px] text-zinc-500">incl. fees</div>
            </div>
          </button>
        ))}
        <div className="p-4">
          <button onClick={() => router.push(`/seatwise/checkout/${ev.id}?tier=${tier}&qty=${qty}`)}
            className="w-full rounded bg-[#024ddf] py-3 font-bold text-white hover:bg-[#0141b9]">
            Next · {usd0(t.price * qty)}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center rounded-lg bg-white p-4 shadow-sm">
        <svg viewBox="0 0 400 300" className="w-full max-w-xl">
          <rect x="140" y="110" width="120" height="80" rx={ev.kind === "concert" ? 4 : 30} fill={ev.kind === "concert" ? "#111" : "#d6b98c"} />
          <text x="200" y="155" textAnchor="middle" fontSize="12" fontWeight="700" fill={ev.kind === "concert" ? "#fff" : "#5b4520"}>
            {ev.kind === "concert" ? "STAGE" : ev.league === "NHL" ? "ICE" : ev.league === "NFL" || ev.league === "NCAAF" ? "FIELD" : "COURT"}
          </text>
          {[3, 2, 1, 0].map((i) => {
            const inset = [0, 24, 46, 66][i];
            return (
              <rect key={i} x={40 + inset} y={20 + inset * 0.7} width={320 - inset * 2} height={260 - inset * 1.4} rx={60 - inset * 0.5}
                fill="none" stroke={TIER_COLORS[i]} strokeWidth={idx === i ? 20 : 14} opacity={idx === i ? 1 : 0.35} />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
