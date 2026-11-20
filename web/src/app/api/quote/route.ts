import { NextResponse } from "next/server";
import { getEvent, offeredCoverages } from "@/lib/service";
import { quote } from "@/lib/coverage";

export async function POST(req: Request) {
  const { eventId, rooting = "home", tierId, qty = 1 } = await req.json();
  const { ev } = await getEvent(eventId);
  if (!ev) return NextResponse.json({ error: "Unknown event" }, { status: 404 });
  const tier = ev.tiers.find((t) => t.id === tierId) ?? ev.tiers[0];
  const covs = await offeredCoverages(ev, rooting);
  return NextResponse.json({
    coverages: covs.map((c) => ({ coverage: c, quote: quote(c, tier.price * qty, c.defaultRefundPct) })),
  });
}
