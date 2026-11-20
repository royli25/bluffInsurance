import "server-only";
import crypto from "node:crypto";
import { getPricingMarkets, getMarkets } from "./gemini/client";
import { placeHedge } from "./gemini/trading";
import {
  arcMode,
  recordPolicyOnArc,
  settleOnArc,
  toBytes32,
} from "./arc/client";
import {
  assertStreamConfiguration,
  streamConfirmationRequired,
} from "./quicknode/config";
import { buildCatalog, sportsEventFrom, type TicketEvent } from "./catalog";
import {
  buildCoverages,
  quote,
  relatedMarkets,
  type Coverage,
  type CoverageId,
} from "./coverage";
import { db, type OfferConfig, type Policy } from "./store";
import { validateCheckoutQuote, type CheckoutQuote } from "./checkout-quote";
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
    coverages: Object.fromEntries(
      covs.map((c) => [c.id, { enabled: true, refundPct: c.defaultRefundPct }]),
    ),
    updatedAt: new Date().toISOString(),
  };
}

/** Coverages the organizer has enabled for checkout, with their refund %. */
export async function offeredCoverages(
  ev: TicketEvent,
  rooting: "home" | "away",
) {
  const u = await getMarkets();
  const all = buildCoverages(u, ev, rooting);
  const cfg = db.offer(ev.id) ?? defaultOffer(ev.id, all);
  if (!cfg.published) return [];
  return all
    .filter((c) => cfg.coverages[c.id]?.enabled === true)
    .map((c) => ({
      ...c,
      defaultRefundPct: cfg.coverages[c.id]?.refundPct ?? c.defaultRefundPct,
    }));
}

/** A short-lived, server-priced demo quote; never reserves a live hedge. */
export async function createCheckoutQuote(input: { eventId: string; tierId: string; qty: number; rooting: "home" | "away" }): Promise<CheckoutQuote> {
  if (!Number.isInteger(input.qty) || input.qty < 1 || input.qty > 6 || !["home", "away"].includes(input.rooting))
    throw new Error("Choose a valid team and between 1 and 6 tickets.");
  const { ev, universe } = await getEvent(input.eventId);
  if (!ev) throw new Error("Unknown event");
  const tier = ev.tiers.find((t) => t.id === input.tierId);
  if (!tier) throw new Error("Unknown ticket tier");
  if (!db.offer(ev.id)?.published) throw new Error("Protection is not published for this event.");
  const markets = await getPricingMarkets(buildCoverages(universe, ev, input.rooting).map((c) => c.hedge.eventTicker));
  const cfg = db.offer(ev.id);
  if (!cfg?.published) throw new Error("Protection is no longer available.");
  const options = buildCoverages(markets, ev, input.rooting)
    .filter((c) => cfg.coverages[c.id]?.enabled)
    .map((c) => {
      const coverage = { ...c, defaultRefundPct: cfg.coverages[c.id]!.refundPct };
      return { coverage, price: quote(coverage, tier.price * input.qty) };
    });
  const now = Date.now();
  const result: CheckoutQuote = {
    id: crypto.randomUUID(), ...input, offerVersion: cfg.updatedAt,
    createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 30_000).toISOString(),
    marketFetchedAt: markets.fetchedAt,
    source: markets.source === "live" && options.every((o) => !o.coverage.hedge.indicative) ? "live" : "estimate",
    options,
  };
  db.saveQuote(result);
  return result;
}

export async function purchase(input: {
  eventId: string;
  coverageId: CoverageId;
  rooting: "home" | "away";
  tierId: string;
  qty: number;
  holderName: string;
  holderEmail: string;
  demo?: boolean;
  requestId?: string;
  quoteId?: string;
}): Promise<Policy> {
  const mode = input.demo ? "simulated" : arcMode();
  assertStreamConfiguration(mode);
  if (
    typeof input.holderName !== "string" ||
    !input.holderName.trim() ||
    input.holderName.length > 100 ||
    typeof input.holderEmail !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.holderEmail) ||
    input.holderEmail.length > 200
  )
    throw new Error("Enter a customer name and valid email address.");
  if (input.rooting !== "home" && input.rooting !== "away")
    throw new Error("Choose a valid team.");
  if (!Number.isInteger(input.qty) || input.qty < 1 || input.qty > 6)
    throw new Error("Choose between 1 and 6 tickets.");
  if (input.demo && !db.offer(input.eventId)?.published)
    throw new Error(
      "Publish protection for this event before opening checkout.",
    );
  if (input.requestId && !/^[a-zA-Z0-9-]{20,80}$/.test(input.requestId))
    throw new Error("Invalid checkout request ID.");
  const { ev } = await getEvent(input.eventId);
  if (!ev) throw new Error("Unknown event");
  const tier = ev.tiers.find((t) => t.id === input.tierId) ?? ev.tiers[0];
  const id =
    input.demo && input.requestId
      ? `pol_demo_${crypto.createHash("sha256").update(input.requestId).digest("hex").slice(0, 20)}`
      : `pol_${crypto.randomBytes(5).toString("hex")}`;
  const previous = db.policy(id);
  function reuse(previous: Policy) {
    if (
      previous.eventId !== input.eventId ||
      previous.coverageId !== input.coverageId ||
      previous.qty !== input.qty ||
      previous.tierName !== tier.name ||
      previous.holderName !== input.holderName ||
      previous.holderEmail !== input.holderEmail
    )
      throw new Error(
        "This checkout request already belongs to another order.",
      );
    return previous;
  }
  if (previous) return reuse(previous);
  // Only the demo supports a time-bound price until live execution can guarantee a fill.
  const held = input.demo ? validateCheckoutQuote(
    input.quoteId ? db.checkoutQuote(input.quoteId) : undefined,
    input, db.offer(input.eventId)?.updatedAt ?? "",
  ) : undefined;
  const covs = held ? held.options.map((o) => o.coverage) : await offeredCoverages(ev, input.rooting);
  const cov = covs.find((c) => c.id === input.coverageId);
  if (!cov) throw new Error("Coverage not offered");
  const ticketTotal = tier.price * input.qty;
  const q = held?.options.find((o) => o.coverage.id === cov.id)?.price ?? quote(cov, ticketTotal, cov.defaultRefundPct);

  if (held && (q.ticketTotal !== ticketTotal || !db.offer(ev.id)?.coverages[cov.id]?.enabled || db.offer(ev.id)?.coverages[cov.id]?.refundPct !== q.refundPct))
    throw new Error("Protection changed. Refresh prices before purchasing.");

  // 1) Hedge on Gemini (buy the contract that pays when the refund is owed)
  const hedge = await placeHedge(
    {
      symbol: cov.hedge.instrumentSymbol,
      orderType: "limit",
      side: "buy",
      outcome: cov.hedge.outcome,
      quantity: q.contracts.toFixed(2),
      price: Math.min(0.99, cov.hedge.price).toFixed(2),
    },
    input.demo,
  );

  const marketRef = `${cov.hedge.eventTicker}:${cov.id}`;
  const policy: Policy = {
    id,
    quoteId: held?.id,
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
    arc: {
      mode,
      policyIdHex: toBytes32(id),
      marketRefHex: toBytes32(marketRef),
    },
    status: "pending",
    confirmationMode:
      mode === "simulated"
        ? "simulated"
        : streamConfirmationRequired(mode)
          ? "stream"
          : "receipt",
  };
  // Persist customer/order context before sending the transaction. The event
  // journal can now recover a purchase even if this process dies after sending.
  try {
    db.addPolicy(policy);
  } catch (error) {
    // Concurrent retries can race across Node processes. The transactional
    // store admits one demo order; every retry receives that same order.
    const committed = input.demo ? db.policy(id) : undefined;
    if (committed) return reuse(committed);
    throw error;
  }
  try {
    const arc = await recordPolicyOnArc({
      simulate: input.demo,
      policyId: id,
      premium: q.premium,
      payout: q.payout,
      marketRef,
      trigger: cov.trigger,
      expiry: new Date(new Date(ev.startTime).getTime() + 2 * 86400_000),
    });
    db.updatePolicies((p) =>
      p.id === id
        ? {
            ...p,
            arc,
            status: streamConfirmationRequired(arc.mode) ? "pending" : "active",
          }
        : p,
    );
  } catch {
    // A receipt/RPC timeout does not prove that the transaction failed. Keep
    // the recoverable intent instead of inviting another hedge/purchase.
    db.updatePolicies((p) =>
      p.id === id
        ? {
            ...p,
            purchaseError:
              "Arc confirmation is unavailable. Waiting for reconciliation; do not repurchase.",
          }
        : p,
    );
  }
  return db.policy(id)!;
}

/** Oracle: settle every active policy on a market. `triggered` comes from Gemini resolution (or the demo control). */
export async function settle(
  eventId: string,
  coverageId: CoverageId,
  triggered: boolean,
  demoOnly = false,
) {
  const targets = db
    .policies()
    .filter(
      (p) =>
        p.eventId === eventId &&
        p.coverageId === coverageId &&
        p.status === "active",
      // filter below also keeps demo controls away from real policies
    )
    .filter((p) => !demoOnly || p.arc.mode === "simulated");
  if (!targets.length) return { settled: 0 };
  if (new Set(targets.map((p) => p.arc.mode)).size > 1)
    throw new Error("Resolve demo and live contracts separately.");
  if (!db.claimSettlement(targets.map((p) => p.id)))
    throw new Error(
      "Settlement is already being processed. Wait for chain confirmation.",
    );
  const marketRef = `${targets[0].hedgeLeg.eventTicker}:${coverageId}`;
  const hedgeProceeds = triggered
    ? targets.reduce(
        (s, p) =>
          s +
          Number(p.hedge.filledQuantity) * (p.hedgeType === "full" ? 1 : 0.12),
        0,
      )
    : 0;
  const totalPayout = targets.reduce((s, p) => s + p.payout, 0);
  const ids = new Set(targets.map((p) => p.id));
  let arc;
  try {
    arc = await settleOnArc(
      marketRef,
      triggered,
      targets.map((p) => p.id),
      hedgeProceeds,
      totalPayout,
      targets.every((p) => p.arc.mode === "simulated"),
    );
  } catch {
    db.updatePolicies((p) =>
      ids.has(p.id)
        ? {
            ...p,
            settlementError:
              "Settlement submission needs reconciliation. Do not resubmit until the Arc transaction is checked.",
          }
        : p,
    );
    throw new Error(
      "Settlement confirmation is unavailable. The policies are held for reconciliation to prevent a duplicate payout.",
    );
  }
  const pendingConfirmation = streamConfirmationRequired(arc.mode);
  db.updatePolicies((p) =>
    ids.has(p.id)
      ? {
          ...p,
          status: pendingConfirmation
            ? "settling"
            : triggered
              ? "paid"
              : "expired",
          settledAt: pendingConfirmation ? undefined : new Date().toISOString(),
          settlement: { triggered, arc, hedgeProceeds },
        }
      : p,
  );
  return { settled: targets.length, arc, hedgeProceeds, pendingConfirmation };
}

/** Organizer "drop an event": find the Gemini markets that describe it. */
export async function matchEvent(
  query: string,
  kind: "sports" | "concert",
  city?: string,
) {
  const u = await getMarkets();
  if (kind === "concert") {
    const c = (city ?? query).toLowerCase();
    return u.events
      .filter(
        (e) => e.category === "Weather" && e.title.toLowerCase().includes(c),
      )
      .sort((a, b) => (b.expiryDate ?? "").localeCompare(a.expiryDate ?? ""))
      .slice(0, 5)
      .map((e) => ({ event: e, score: 1, related: 1 }));
  }
  const toks = query
    .toLowerCase()
    .replace(/[^a-z0-9& ]/g, " ")
    .split(/\s+/)
    .filter(
      (t) =>
        t.length > 1 &&
        !["vs", "at", "the", "game", "night", "tickets"].includes(t),
    );
  const score = (e: GEvent) => {
    let s = 0;
    for (const p of e.participants) {
      const words = `${p.name} ${p.abbreviation}`.toLowerCase().split(/\s+/);
      if (toks.some((t) => words.includes(t))) s += 1;
    }
    return s;
  };
  return u.events
    .filter(
      (e) =>
        e.category === "Sports" &&
        !e.title.includes(":") &&
        e.participants.length === 2,
    )
    .map((e) => ({ event: e, score: score(e) }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.event.startTime ?? "").localeCompare(b.event.startTime ?? ""),
    )
    .slice(0, 6)
    .map((x) => ({
      ...x,
      related: relatedMarkets(u, sportsEventFrom(x.event)!).length,
    }));
}

export async function createCustomEvent(input: {
  geminiTicker: string;
  title?: string;
  kind: "sports" | "concert";
  venue?: string;
  city?: string;
  artist?: string;
}) {
  const u = await getMarkets();
  const g = u.events.find((e) => e.ticker === input.geminiTicker);
  if (!g) throw new Error("Gemini market not found");
  let ev: TicketEvent;
  if (input.kind === "sports") {
    const base = sportsEventFrom(g)!;
    ev = {
      ...base,
      id: `custom-${base.id}`,
      title: input.title || base.title,
      custom: true,
      venue: input.venue || base.venue,
    };
  } else {
    const city =
      input.city ??
      g.title.replace("Highest temperature in ", "").split(" on ")[0];
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
