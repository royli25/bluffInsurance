import { NextResponse } from "next/server";
import { getEvent, defaultOffer } from "@/lib/service";
import { buildCoverages } from "@/lib/coverage";
import { scanCoverageMarkets } from "@/lib/markets/scan";
import { db } from "@/lib/store";
export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const { ev, universe } = await getEvent(params.get("eventId") ?? "");
    if (!ev) return NextResponse.json({ error: "Unknown event" }, { status: 404 });
    const cfg = db.offer(ev.id) ?? { ...defaultOffer(ev.id, buildCoverages(universe, ev)), published: false };
    return NextResponse.json(await scanCoverageMarkets(ev, universe, cfg, params.get("tierId") ?? ev.tiers[0].id), { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Market comparison is unavailable." }, { status: 503 }); }
}
