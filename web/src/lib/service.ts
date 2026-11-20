import "server-only";
import crypto from "node:crypto";
import { getMarkets } from "./gemini/client";
import { placeHedge } from "./gemini/trading";
import { recordPolicyOnArc, settleOnArc } from "./arc/client";
import { buildCatalog, sportsEventFrom, type TicketEvent } from "./catalog";
import { buildCoverages, quote, relatedMarkets, type Coverage, type CoverageId } from "./coverage";
import { db, type OfferConfig, type Policy } from "./store";
import type { GEvent } from "./gemini/types";

export async function getCatalog() {
  const u = await getMarkets();
  return { universe: u, catalog: buildCatalog(u, db.customEvents()) };
}

export async function getEvent(id: string) {
  const { universe, catalog } = await getCatalog();
  const ev = catalog.find((e) => e.id === id);
  return { universe, ev };
}

export function defaultOffer(eventId: string, covs: Coverage[]): OfferConfig {
  return {
    eventId,
    published: true,
    coverages: Object.fromEntries(covs.map((c) => [c.id, { enabled: true, refundPct: c.defaultRefundPct }])),
    updatedAt: new Date().toISOString(),
  };
}

/** Coverages the organizer has enabled for checkout, with their refund %. */
export async function offeredCoverages(ev: TicketEvent, rooting: "home" | "away") {
  const u = await getMarkets();
  const all = buildCoverages(u, ev, rooting);
  const cfg = db.offer(ev.id) ?? defaultOffer(ev.id, all);
  if (!cfg.published) return [];
  return all
    .filter((c) => cfg.coverages[c.id]?.enabled !== false)
    .map((c) => ({ ...c, defaultRefundPct: cfg.coverages[c.id]?.refundPct ?? c.defaultRefundPct }));
}

export async function purchase(input: {
  eventId: string;
  coverageId: CoverageId;
  rooting: "home" | "away";
  tierId: string;
  qty: number;
  holderName: string;
  holderEmail: string;
}): Promise<Policy> {
  const { ev } = await getEvent(input.eventId);
  if (!ev) throw new Error("Unknown event");
  const tier = ev.tiers.find((t) => t.id === input.tierId) ?? ev.tiers[0];
  const covs = await offeredCoverages(ev, input.rooting);
  const cov = covs.find((c) => c.id === input.coverageId);
  if (!cov) throw new Error("Coverage not offered");
  const ticketTotal = tier.price * input.qty;
  const q = quote(cov, ticketTotal, cov.defaultRefundPct);
  const id = `pol_${crypto.randomBytes(5).toString("hex")}`;

  // 1) Hedge on Gemini (buy the contract that pays when the refund is owed)
  const hedge = await placeHedge({
    symbol: cov.hedge.instrumentSymbol,
    orderType: "limit",
    side: "buy",
    outcome: cov.hedge.outcome,
    quantity: q.contracts.toFixed(2),
    price: Math.min(0.99, cov.hedge.price).toFixed(2),
  });

  // 2) Record the policy + escrow premium on Arc
  const arc = await recordPolicyOnArc({
    policyId: id,
    premium: q.premium,
    payout: q.payout,
    marketRef: `${cov.hedge.eventTicker}:${cov.id}`,
    trigger: cov.trigger,
    expiry: new Date(new Date(ev.startTime).getTime() + 2 * 86400_000),
  });

  const policy: Policy = {
    id,
    createdAt: new Date().toISOString(),
    eventId: ev.id,
    eventTitle: ev.title,
    eventStart: ev.startTime,
    venue: ev.venue,
    coverageId: cov.id,
    coverageName: cov.name,
    emoji: cov.emoji,
    trigger: cov.trigger,
    hedgeType: cov.hedgeType,
    holderName: input.holderName,
    holderEmail: input.holderEmail,
    tierName: tier.name,
    qty: input.qty,
    ticketTotal,
    refundPct: q.refundPct,
    payout: q.payout,
    premium: q.premium,
    hedgeLeg: cov.hedge,
    hedge,
    arc,
    status: "active",
  };
  db.addPolicy(policy);
  return policy;
}

/** Oracle: settle every active policy on a market. `triggered` comes from Gemini resolution (or the demo control). */
export async function settle(eventId: string, coverageId: CoverageId, triggered: boolean) {
  const targets = db.policies().filter((p) => p.eventId === eventId && p.coverageId === coverageId && p.status === "active");
  if (!targets.length) return { settled: 0 };
  const marketRef = `${targets[0].hedgeLeg.eventTicker}:${coverageId}`;
  const hedgeProceeds = triggered
    ? targets.reduce((s, p) => s + Number(p.hedge.filledQuantity) * (p.hedgeType === "full" ? 1 : 0.12), 0)
    : 0;
  const totalPayout = targets.reduce((s, p) => s + p.payout, 0);
  const arc = await settleOnArc(marketRef, triggered, targets.map((p) => p.id), hedgeProceeds, totalPayout);
  const ids = new Set(targets.map((p) => p.id));
  db.updatePolicies((p) =>
    ids.has(p.id)
      ? { ...p, status: triggered ? "paid" : "expired", settledAt: new Date().toISOString(), settlement: { triggered, arc, hedgeProceeds } }
      : p,
  );
  return { settled: targets.length, arc, hedgeProceeds };
}

/** Organizer "drop an event": find the Gemini markets that describe it. */
export async function matchEvent(query: string, kind: "sports" | "concert", city?: string) {
  const u = await getMarkets();
  if (kind === "concert") {
    const c = (city ?? query).toLowerCase();
    return u.events
      .filter((e) => e.category === "Weather" && e.title.toLowerCase().includes(c))
      .sort((a, b) => (b.expiryDate ?? "").localeCompare(a.expiryDate ?? ""))
      .slice(0, 5)
      .map((e) => ({ event: e, score: 1, related: 1 }));
  }
  const toks = query
    .toLowerCase()
    .replace(/[^a-z0-9& ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !["vs", "at", "the", "game", "night", "tickets"].includes(t));
  const score = (e: GEvent) => {
    let s = 0;
    for (const p of e.participants) {
      const words = `${p.name} ${p.abbreviation}`.toLowerCase().split(/\s+/);
      if (toks.some((t) => words.includes(t))) s += 1;
    }
    return s;
  };
  return u.events
    .filter((e) => e.category === "Sports" && !e.title.includes(":") && e.participants.length === 2)
    .map((e) => ({ event: e, score: score(e) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.event.startTime ?? "").localeCompare(b.event.startTime ?? ""))
    .slice(0, 6)
    .map((x) => ({ ...x, related: relatedMarkets(u, sportsEventFrom(x.event)!).length }));
}

export async function createCustomEvent(input: { geminiTicker: string; title?: string; kind: "sports" | "concert"; venue?: string; city?: string; artist?: string }) {
  const u = await getMarkets();
  const g = u.events.find((e) => e.ticker === input.geminiTicker);
  if (!g) throw new Error("Gemini market not found");
  let ev: TicketEvent;
  if (input.kind === "sports") {
    const base = sportsEventFrom(g)!;
    ev = { ...base, id: `custom-${base.id}`, title: input.title || base.title, custom: true, venue: input.venue || base.venue };
  } else {
    const city = input.city ?? g.title.replace("Highest temperature in ", "").split(" on ")[0];
    ev = {
      id: `custom-concert-${crypto.randomBytes(3).toString("hex")}`,
      kind: "concert",
      title: input.artist || input.title || "Live Show",
      subtitle: "Outdoor show",
      league: "Concert",
      venue: input.venue || `${city} Outdoor Stage`,
      city,
      startTime: g.expiryDate ?? new Date().toISOString(),
      weatherTicker: g.ticker,
      weatherTitle: g.title,
      tiers: [
        { id: "ga", name: "General Admission", section: "GA", price: 79 },
        { id: "reserved", name: "Reserved", section: "Sec B", price: 139 },
        { id: "vip", name: "VIP", section: "VIP Deck", price: 399 },
      ],
      heroFrom: "#7c3aed",
      heroTo: "#f43f5e",
      custom: true,
    };
  }
  db.addCustomEvent(ev);
  return ev;
}
