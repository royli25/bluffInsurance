import Link from "next/link";
import type { TicketEvent } from "@/lib/catalog";
import { dateParts, usd0 } from "@/lib/format";

export default function EventRow({ ev }: { ev: TicketEvent }) {
  const d = dateParts(ev.startTime);
  const from = Math.min(...ev.tiers.map((t) => t.price));
  return (
    <div className="flex items-center gap-4 border-b border-neutral-200 py-4">
      <div className="w-14 shrink-0 text-center">
        <div className="text-sm font-semibold text-neutral-500">{d.mon}</div>
        <div className="text-xl font-semibold leading-none">{d.day}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-neutral-500">{d.dow} · {d.time}</div>
        <div className="truncate font-semibold">{ev.title}</div>
        <div className="truncate text-sm text-neutral-600">{ev.city} · {ev.venue}</div>
        <div className="mt-1 inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-sm font-semibold text-emerald-700">🛡️ Bluff Protect available</div>
      </div>
      <div className="hidden text-right text-sm text-neutral-500 sm:block">from <span className="font-semibold text-neutral-900">{usd0(from)}</span></div>
      <Link href={`/seatwise/event/${ev.id}`} className="shrink-0 rounded bg-[#024ddf] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0141b9]">Find Tickets</Link>
    </div>
  );
}
