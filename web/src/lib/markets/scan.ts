import "server-only";
import type { TicketEvent } from "../catalog";
import { buildCoverages, quote } from "../coverage";
import { getPricingMarkets } from "../gemini/client";
import { getGeminiBook } from "../gemini/book";
import type { MarketUniverse } from "../gemini/types";
import { getKalshiBook } from "../kalshi/client";
import type { OfferConfig } from "../store";
import { priceBook, selectBest } from "./pricing";
import type { MarketCandidate, MarketScan } from "./types";

export async function scanCoverageMarkets(ev: TicketEvent, universe: MarketUniverse, cfg: OfferConfig, tierId: string, qty = 1, rooting: "home" | "away" = "home"): Promise<MarketScan> {
  const baseline = buildCoverages(universe, ev, rooting);
  const moneyline = ev.league === "NBA" ? baseline.find((c) => c.id === "team-loses") : undefined;
  const total = (ev.tiers.find((t) => t.id === tierId) ?? ev.tiers[0]).price * qty;
  const [fresh, gemini, kalshi] = await Promise.all([
    getPricingMarkets(baseline.map((c) => c.hedge.eventTicker)),
    moneyline ? getGeminiBook(moneyline.hedge.instrumentSymbol, moneyline.hedge.outcome).catch(() => null) : null,
    moneyline ? getKalshiBook(ev, rooting) : null,
  ]);
  const current = buildCoverages(fresh, ev, rooting);
  const markets = baseline.map((base) => {
    const coverage = { ...(current.find((c) => c.id === base.id) ?? base), defaultRefundPct: cfg.coverages[base.id]?.refundPct ?? base.defaultRefundPct };
    const fallback: MarketCandidate = { provider: "gemini", state: "estimate", coverage: { ...coverage, hedge: { ...coverage.hedge, provider: "gemini" } }, price: quote(coverage, total), reason: "Order book unavailable; indicative estimate", observedAt: fresh.fetchedAt };
    let candidates: MarketCandidate[];
    if (coverage.id === "team-loses" && ev.league === "NBA") {
      const active = fresh.source === "live" && fresh.events.some((e) => e.ticker === coverage.hedge.eventTicker && e.status === "active");
      candidates = [gemini && active ? priceBook(coverage, total, gemini) : fallback,
        kalshi ? priceBook(coverage, total, kalshi) : { provider: "kalshi", state: "unavailable", reason: "No matching live order book" }];
    } else {
      candidates = [{ ...fallback, state: fresh.source === "live" && !coverage.hedge.indicative ? "live" : "estimate", reason: coverage.hedgeType === "partial" ? "Modeled protection with a proxy hedge" : "Gemini market price" }];
    }
    return { coverage, candidates, selected: selectBest(candidates, cfg.coverages[coverage.id]?.providers)?.provider };
  });
  return { scannedAt: new Date().toISOString(), markets };
}
