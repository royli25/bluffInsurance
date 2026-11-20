import { notFound } from "next/navigation";
import SeatwiseHeader from "@/components/SeatwiseHeader";
import TicketPicker from "@/components/TicketPicker";
import { getEvent, offeredCoverages } from "@/lib/service";
import { dateParts } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ev } = await getEvent(id);
  if (!ev) notFound();
  const covs = await offeredCoverages(ev, "home");
  const d = dateParts(ev.startTime);
  return (
    <div className="min-h-screen bg-zinc-100">
      <SeatwiseHeader />
      <div style={{ background: `linear-gradient(110deg, ${ev.heroFrom}, #0b1020 50%, ${ev.heroTo})` }}>
        <div className="mx-auto max-w-6xl px-4 py-8 text-white">
          <div className="text-xs font-bold uppercase tracking-widest text-white/70">{ev.subtitle}</div>
          <h1 className="mt-1 text-2xl font-black sm:text-4xl">{ev.title}</h1>
          <div className="mt-1 text-white/85">{d.long} · {ev.venue}, {ev.city}</div>
        </div>
      </div>
      {covs.length > 0 && (
        <div className="border-b border-emerald-200 bg-emerald-50">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm text-emerald-900">
            <b>🛡️ Bluff Protect available for this event:</b>
            {covs.map((c) => <span key={c.id}>{c.emoji} {c.trigger}</span>)}
          </div>
        </div>
      )}
      <TicketPicker ev={ev} />
    </div>
  );
}
