import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import type { GEvent, MarketUniverse } from "./types";

/**
 * Gemini Prediction Markets — public market data.
 * Docs: https://developer.gemini.com/prediction-markets/getting-started
 * The events endpoint is public (no key). We page through every active event,
 * normalize it, and cache for 60s. If Gemini is unreachable we fall back to a
 * snapshot committed in /data so the demo never breaks.
 */
export const GEMINI_BASE = process.env.GEMINI_API_BASE ?? "https://api.gemini.com";
const TTL_MS = 60_000;

let cache: { at: number; data: MarketUniverse } | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ruleText(c: any): string {
  const d = c?.description;
  if (!d || typeof d !== "object") return "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (d.content ?? []).map((n: any) => n?.value ?? "").join(" ").slice(0, 500);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeEvent(e: any): GEvent {
  const cs = e.contracts ?? [];
  return {
    id: String(e.id),
    title: e.title,
    category: e.category,
    ticker: e.ticker,
    startTime: e.startTime ?? null,
    expiryDate: e.expiryDate ?? null,
    isLive: !!e.isLive,
    volume: e.volume,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    participants: (e.participants ?? []).map((p: any) => ({
      name: p.name,
      abbreviation: p.abbreviation,
      side: p.side,
    })),
    subcategory: e.subcategory?.name ?? e.subcategory ?? null,
    rule: e.rule ?? (cs[0] ? ruleText(cs[0]) : ""),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: cs.map((c: any) => ({
      label: c.label,
      ticker: c.ticker,
      instrumentSymbol: c.instrumentSymbol,
      prices: c.prices ?? {},
      color: c.color ?? null,
      sportsSide: c.sportsSide ?? null,
    })),
  };
}

async function fetchLive(): Promise<GEvent[]> {
  const out: GEvent[] = [];
  for (let offset = 0; offset < 5000; offset += 100) {
    const url = `${GEMINI_BASE}/v1/prediction-markets/events?status=active&limit=100&offset=${offset}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const body = await res.json();
    const page = body.data ?? [];
    out.push(...page.map(normalizeEvent));
    const total = body.pagination?.total;
    if (page.length < 100 || (total && out.length >= total)) break;
  }
  return out;
}

async function loadSnapshot(): Promise<MarketUniverse> {
  const file = path.join(process.cwd(), "data", "gemini-snapshot.json");
  const raw = JSON.parse(await fs.readFile(file, "utf8"));
  return { events: raw.events.map(normalizeEvent), source: "snapshot", fetchedAt: raw.fetchedAt };
}

export async function getMarkets(): Promise<MarketUniverse> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  let data: MarketUniverse;
  if (process.env.GEMINI_OFFLINE === "1") {
    data = await loadSnapshot();
  } else {
    try {
      data = { events: await fetchLive(), source: "live", fetchedAt: new Date().toISOString() };
    } catch (err) {
      console.warn("[gemini] live fetch failed, using snapshot:", (err as Error).message);
      data = await loadSnapshot();
    }
  }
  cache = { at: Date.now(), data };
  return data;
}

/** Look up settlement for one event ticker (used by the settlement oracle). */
export async function getEventByTicker(ticker: string): Promise<GEvent | null> {
  try {
    const res = await fetch(`${GEMINI_BASE}/v1/prediction-markets/events/${encodeURIComponent(ticker)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return normalizeEvent(body.data ?? body);
  } catch {
    return null;
  }
}
