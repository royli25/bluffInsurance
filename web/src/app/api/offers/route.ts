import { NextResponse } from "next/server";
import { db } from "@/lib/store";
import { getEvent } from "@/lib/service";
import { buildCoverages, type CoverageId } from "@/lib/coverage";
import type { OfferConfig } from "@/lib/store";
export async function POST(req: Request) {
  try {
    const { eventId, published, coverages } = await req.json();
    if (
      typeof eventId !== "string" ||
      typeof published !== "boolean" ||
      !coverages ||
      typeof coverages !== "object" ||
      Array.isArray(coverages)
    )
      throw new Error("Invalid protection configuration.");
    const { ev, universe } = await getEvent(eventId);
    if (!ev) throw new Error("Unknown event.");
    const available = buildCoverages(universe, ev);
    const normalized: OfferConfig["coverages"] = {};
    for (const [id, value] of Object.entries(coverages)) {
      if (!available.some((c) => c.id === id))
        throw new Error("Protection is not available for this event.");
      const v = value as { enabled?: unknown; refundPct?: unknown };
      if (
        !v ||
        typeof v.enabled !== "boolean" ||
        typeof v.refundPct !== "number" ||
        !Number.isInteger(v.refundPct) ||
        v.refundPct < 10 ||
        v.refundPct > 100
      )
        throw new Error("Choose a refund between 10% and 100%.");
      normalized[id as CoverageId] = {
        enabled: v.enabled,
        refundPct: v.refundPct,
      };
    }
    if (published && !Object.values(normalized).some((c) => c?.enabled))
      throw new Error(
        "Choose at least one protection option before publishing.",
      );
    db.setOffer({
      eventId,
      published,
      coverages: normalized,
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
