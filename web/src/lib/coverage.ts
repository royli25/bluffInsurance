import type { GContract, GEvent, MarketUniverse } from "./gemini/types";
import { STARS, type TicketEvent } from "./catalog";

/**
 * Coverage engine: event -> matching Gemini markets -> hedgeable protections.
 *
 * Each protection maps a bad-night outcome to ONE Gemini contract side.
 * Fully hedged ("full"): the contract pays $1 exactly when the refund is owed,
 * so buying payout/$1 contracts at the ask means Bluff never carries the risk.
 * Proxy hedged ("partial"): star-sits-out. Gemini player props settle at the
 * "last fair price" if the player logs no minutes, so we hedge with the
 * opponent's moneyline (it reprices up when the star is ruled out) and the
 * residual basis risk is reserve-backed and shown transparently.
 */

export type CoverageId = "team-loses" | "blowout" | "snoozer" | "star-sits" | "cold" | "heat";

export interface HedgeLeg {
  provider?: "gemini" | "kalshi";
  eventTicker: string;
  eventTitle: string;
  contractLabel: string;
  instrumentSymbol: string;
  outcome: "yes" | "no";
  /** best ask for the side we buy, 0..1 */
  price: number;
  /** true when the book has no ask yet: priced off last trade / model, hedge rests as a limit order */
  indicative?: boolean;
}

export interface Coverage {
  id: CoverageId;
  name: string;
  emoji: string;
  trigger: string;
  blurb: string;
  hedgeType: "full" | "partial";
  /** implied probability the refund triggers */
  probability: number;
  defaultRefundPct: number;
  hedge: HedgeLeg;
  /** for partial hedges: contracts bought per $1 of payout */
  hedgeRatio: number;
  basisNote?: string;
}

export interface Quote {
  coverageId: CoverageId;
  ticketTotal: number;
  refundPct: number;
  payout: number;
  contracts: number;
  hedgeCost: number;
  exchangeFee?: number;
  premium: number;
  margin: number;
}

export const PRICING = { margin: 0.18, fee: 0.99, minPremium: 1.99 };

const ask = (c: GContract, side: "yes" | "no"): number | null => {
  const v = c.prices?.buy?.[side];
  const n = v != null ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 && n < 1 ? n : null;
};

/** ask if quoted, else last trade / opposite-side implied / model fallback (flagged indicative) */
const priceOr = (c: GContract, side: "yes" | "no", model: number): { p: number; ind: boolean } => {
  const a = ask(c, side);
  if (a) return { p: a, ind: false };
  const last = Number(c.prices?.lastTradePrice);
  if (Number.isFinite(last) && last > 0 && last < 1) return { p: side === "yes" ? last : Math.round((1 - last) * 100) / 100, ind: true };
  const other = ask(c, side === "yes" ? "no" : "yes");
  if (other) return { p: Math.round((1.02 - other) * 100) / 100, ind: true };
  return { p: model, ind: true };
};

const num = (label: string) => Number(label.match(/(\d+(?:\.\d+)?)/)?.[1] ?? NaN);

export function relatedMarkets(u: MarketUniverse, ev: TicketEvent): GEvent[] {
  if (ev.kind === "concert") return u.events.filter((e) => e.ticker === ev.weatherTicker);
  if (!ev.marketRoot) return [];
  return u.events.filter((e) => e.ticker.startsWith(ev.marketRoot + "-"));
}

function leg(e: GEvent, c: GContract, outcome: "yes" | "no", price: number, indicative = false): HedgeLeg {
  return {
    indicative,
    eventTicker: e.ticker,
    eventTitle: e.title,
    contractLabel: c.label,
    instrumentSymbol: c.instrumentSymbol,
    outcome,
    price,
  };
}

export function buildCoverages(u: MarketUniverse, ev: TicketEvent, rooting: "home" | "away" = "home"): Coverage[] {
  const markets = relatedMarkets(u, ev);
  const out: Coverage[] = [];

  if (ev.kind === "concert") {
    const wx = markets[0];
    if (!wx) return out;
    const lo = wx.contracts.find((c) => /or below/i.test(c.label));
    const hi = wx.contracts.find((c) => /or above/i.test(c.label));
    if (lo) {
      const p = ask(lo, "yes") ?? 0.03;
      out.push({
        id: "cold", name: "Cold Night Cover", emoji: "🥶",
        trigger: `${ev.city} high is ${lo.label.replace("°F or below", "°F or colder")}`,
        blurb: `Outdoor show. If the official NWS high for ${ev.city} comes in at ${lo.label}, you get money back automatically.`,
        hedgeType: "full", probability: p, defaultRefundPct: 50,
        hedge: leg(wx, lo, "yes", p), hedgeRatio: 1,
      });
    }
    if (hi) {
      const p = ask(hi, "yes") ?? 0.03;
      out.push({
        id: "heat", name: "Heat Wave Cover", emoji: "🥵",
        trigger: `${ev.city} high is ${hi.label}`,
        blurb: `If it's a scorcher (${hi.label}, NWS official), you get money back automatically.`,
        hedgeType: "full", probability: p, defaultRefundPct: 50,
        hedge: leg(wx, hi, "yes", p), hedgeRatio: 1,
      });
    }
    return out;
  }

  const fan = rooting === "home" ? ev.home! : ev.away!;
  const opp = rooting === "home" ? ev.away! : ev.home!;
  const oppShort = opp.name.split(" ").slice(-1)[0];
  const fanShort = fan.name.split(" ").slice(-1)[0];

  // 1) Team loses -> buy YES on opponent moneyline
  const ml = markets.find((e) => !e.title.includes(":"));
  const oppML = ml?.contracts.find((c) => c.sportsSide === opp.side);
  const oppQ = oppML ? priceOr(oppML, "yes", 0.45) : null;
  const oppAsk = oppQ?.p ?? null;
  if (ml && oppML && oppAsk) {
    out.push({
      id: "team-loses", name: "Heartbreak Cover", emoji: "💔",
      trigger: `${fanShort} lose`,
      blurb: `If the ${fanShort} lose, part of your ticket comes back. Paid automatically when the game is final.`,
      hedgeType: "full", probability: oppAsk, defaultRefundPct: 15,
      hedge: leg(ml, oppML, "yes", oppAsk, oppQ!.ind), hedgeRatio: 1,
    });
  }

  // 2) Blowout loss -> buy YES on "Opp wins by more than N.5"
  const spread = markets.find((e) => /Point Spread$/.test(e.title) && !/Quarter|Half/.test(e.title));
  if (spread) {
    const target = { NFL: 13.5, NBA: 12.5, NCAAF: 16.5, NCAAM: 12.5 }[ev.league] ?? 10.5;
    const cands = spread.contracts
      .filter((c) => c.label.startsWith(opp.name.split(" ").slice(0, -1).join(" ") || opp.name) || c.label.includes(oppShort) || c.label.startsWith(cityOf(opp.name)))
      .map((c) => ({ c, n: num(c.label), p: ask(c, "yes") }))
      .filter((x) => x.p && x.n >= target - 4)
      .sort((a, b) => Math.abs(a.n - target) - Math.abs(b.n - target));
    const best = cands[0];
    if (best && best.p) {
      const margin = Math.ceil(best.n);
      out.push({
        id: "blowout", name: "Blowout Cover", emoji: "🧯",
        trigger: `${fanShort} lose by ${margin}+`,
        blurb: `Paid a lot to watch a beatdown? If the ${fanShort} lose by ${margin} or more, get a big chunk back.`,
        hedgeType: "full", probability: best.p, defaultRefundPct: 50,
        hedge: leg(spread, best.c, "yes", best.p), hedgeRatio: 1,
      });
    }
  }

  // 3) Snoozer -> buy NO on "More than X points/goals scored"
  const total = markets.find((e) => /: Total (Points|Goals)$/.test(e.title));
  if (total) {
    const cands = total.contracts
      .map((c) => ({ c, n: num(c.label), p: ask(c, "no") }))
      .filter((x) => x.p && x.p >= 0.08 && x.p <= 0.45)
      .sort((a, b) => Math.abs((a.p ?? 0) - 0.25) - Math.abs((b.p ?? 0) - 0.25));
    const best = cands[0];
    if (best && best.p) {
      const unit = /Goals/.test(total.title) ? "goals" : "points";
      const under = Math.floor(best.n);
      out.push({
        id: "snoozer", name: "Snoozer Cover", emoji: "😴",
        trigger: `${under} or fewer total ${unit}`,
        blurb: `If it's a defensive slog with ${under} or fewer combined ${unit}, you get money back.`,
        hedgeType: "full", probability: best.p, defaultRefundPct: 25,
        hedge: leg(total, best.c, "no", best.p), hedgeRatio: 1,
      });
    }
  }

  // 4) Star sits out -> proxy hedge on opponent moneyline
  const star = STARS[ev.league]?.[fan.abbr];
  if (star && ml && oppML && oppAsk) {
    const pSit = 0.08; // modeled DNP rate for marquee players (injury report base rate)
    const expectedJump = 0.12; // typical opponent ML reprice when a star is ruled out
    out.push({
      id: "star-sits", name: "Star Sits Cover", emoji: "⭐",
      trigger: `${star} doesn't play`,
      blurb: `Bought tickets to see ${star}? If he's inactive, you get money back — no questions.`,
      hedgeType: "partial", probability: pSit, defaultRefundPct: 35,
      hedge: leg(ml, oppML, "yes", oppAsk, oppQ!.ind),
      hedgeRatio: Math.round((1 / expectedJump) * 0.35 * 100) / 100,
      basisNote:
        "Gemini player props settle at last fair price on a DNP, so there is no direct contract. We buy opponent-win contracts that reprice ~12¢ when a star is ruled out and sell into the move; the residual is backed by the Bluff reserve.",
    });
  }
  return out;
}

function cityOf(name: string) {
  return name.split(" ").slice(0, -1).join(" ");
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function quote(c: Coverage, ticketTotal: number, refundPct = c.defaultRefundPct): Quote {
  const payout = r2((ticketTotal * refundPct) / 100);
  let contracts: number;
  let hedgeCost: number;
  let premium: number;
  if (c.hedgeType === "full") {
    contracts = r2(payout); // each contract pays $1
    hedgeCost = r2(contracts * c.hedge.price);
    premium = hedgeCost * (1 + PRICING.margin) + PRICING.fee;
  } else {
    contracts = r2(payout * c.hedgeRatio);
    hedgeCost = r2(contracts * c.hedge.price);
    const expectedLoss = payout * c.probability;
    premium = expectedLoss * (1 + PRICING.margin) + PRICING.fee + hedgeCost * 0.01; // carry on the proxy position
  }
  premium = r2(Math.max(PRICING.minPremium, premium));
  return { coverageId: c.id, ticketTotal, refundPct, payout, contracts, hedgeCost, premium, margin: r2(premium - (c.hedgeType === "full" ? hedgeCost : payout * c.probability)) };
}
