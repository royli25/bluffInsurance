import { NextResponse } from "next/server";
import { PROVIDERS, type ProviderSettings } from "@/lib/markets/types";
import { db } from "@/lib/store";
import { getEvent } from "@/lib/service";
import { buildCoverages, type CoverageId } from "@/lib/coverage";
import type { OfferConfig } from "@/lib/store";
export async function POST(req: Request) {
  try {
    const { eventId, published, coverages, expectedUpdatedAt } = await req.json();
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
      const v = value as { enabled?: unknown; refundPct?: unknown; providers?: unknown };
      if (
        !v ||
        typeof v.enabled !== "boolean" ||
        typeof v.refundPct !== "number" ||
        !Number.isInteger(v.refundPct) ||
        v.refundPct < 10 ||
        v.refundPct > 100
      )
        throw new Error("Choose a refund between 10% and 100%.");
      let providers: ProviderSettings | undefined;
      if (v.providers !== undefined) {
        if (!v.providers || typeof v.providers !== "object" || Array.isArray(v.providers) || Object.entries(v.providers).some(([key, on]) => !PROVIDERS.includes(key as "gemini" | "kalshi") || typeof on !== "boolean"))
          throw new Error("Invalid market provider settings.");
        providers = v.providers as ProviderSettings;
        const supported = ev.league === "NBA" && id === "team-loses" ? PROVIDERS : ["gemini"] as const;
        if (published && v.enabled && !supported.some((p) => providers?.[p] !== false))
          throw new Error("Enable at least one provider for each active protection.");
      }
      normalized[id as CoverageId] = {
        enabled: v.enabled,
        refundPct: v.refundPct,
        ...(providers ? { providers } : {}),
      };
    }
    if (published && !Object.values(normalized).some((c) => c?.enabled))
      throw new Error(
        "Choose at least one protection option before publishing.",
      );
    if (expectedUpdatedAt !== undefined && typeof expectedUpdatedAt !== "string") throw new Error("Invalid offer version.");
    const offer = {
      eventId,
      published,
      coverages: normalized,
      updatedAt: new Date().toISOString(),
    };
    const saved = db.setOffer(offer, expectedUpdatedAt);
    return NextResponse.json({ ok: true, offer: saved });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
