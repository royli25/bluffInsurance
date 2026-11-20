import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { TicketEvent } from "./catalog";
import type { CoverageId, HedgeLeg } from "./coverage";
import type { HedgeFill } from "./gemini/trading";
import type { ArcReceipt } from "./arc/client";

/** Tiny JSON-file store (demo). Swap for Postgres/Supabase in prod. */

export interface Policy {
  id: string;
  createdAt: string;
  eventId: string;
  eventTitle: string;
  eventStart: string;
  venue: string;
  coverageId: CoverageId;
  coverageName: string;
  emoji: string;
  trigger: string;
  hedgeType: "full" | "partial";
  holderName: string;
  holderEmail: string;
  tierName: string;
  qty: number;
  ticketTotal: number;
  refundPct: number;
  payout: number;
  premium: number;
  hedgeLeg: HedgeLeg;
  hedge: HedgeFill;
  arc: ArcReceipt;
  status: "active" | "paid" | "expired";
  settledAt?: string;
  settlement?: { triggered: boolean; arc: ArcReceipt; hedgeProceeds: number };
}

export interface OfferConfig {
  eventId: string;
  published: boolean;
  coverages: Partial<Record<CoverageId, { enabled: boolean; refundPct: number }>>;
  updatedAt: string;
}

interface DB {
  policies: Policy[];
  offers: Record<string, OfferConfig>;
  customEvents: TicketEvent[];
}

const FILE = path.join(process.cwd(), "data", "runtime", "db.json");

function load(): DB {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { policies: [], offers: {}, customEvents: [] };
  }
}

function save(db: DB) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

export const db = {
  policies: () => load().policies.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  addPolicy(p: Policy) {
    const d = load();
    d.policies.push(p);
    save(d);
  },
  updatePolicies(fn: (p: Policy) => Policy) {
    const d = load();
    d.policies = d.policies.map(fn);
    save(d);
  },
  offer: (eventId: string): OfferConfig | undefined => load().offers[eventId],
  offers: () => load().offers,
  setOffer(o: OfferConfig) {
    const d = load();
    d.offers[o.eventId] = o;
    save(d);
  },
  customEvents: () => load().customEvents,
  addCustomEvent(e: TicketEvent) {
    const d = load();
    d.customEvents = [e, ...d.customEvents.filter((x) => x.id !== e.id)];
    save(d);
  },
  reset() {
    save({ policies: [], offers: {}, customEvents: [] });
  },
};
