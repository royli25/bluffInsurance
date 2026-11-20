import { buildCoverages, type Coverage } from "./coverage";
import type { TicketEvent } from "./catalog";
import type { MarketUniverse } from "./gemini/types";
import type { OfferConfig } from "./store";

/** An active offer can sell new coverage; existing customer contracts are separate. */
export function enabledCoverages(event: TicketEvent, coverages: Coverage[], offer?: OfferConfig) {
  if (!offer?.published) return [];
  return coverages.filter((coverage) => {
    const config = offer.coverages[coverage.id];
    if (!config?.enabled) return false;
    const providers = event.league === "NBA" && coverage.id === "team-loses" ? ["gemini", "kalshi"] as const : ["gemini"] as const;
    return providers.some((provider) => config.providers?.[provider] !== false);
  });
}
export function eventsWithCoverage(catalog: TicketEvent[], offers: Record<string, OfferConfig>, universe: MarketUniverse) {
  return catalog.filter((event) => enabledCoverages(event, buildCoverages(universe, event), offers[event.id]).length > 0);
}
