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
export const GEMINI_BASE =
  process.env.GEMINI_API_BASE ?? "https://api.gemini.com";
const TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 4_000;
const PAGE_SIZE = 100;
const PAGE_CONCURRENCY = 4;

type MarketState = {
  cache: { at: number; data: MarketUniverse } | null;
  pending: Promise<void> | null;
  bootstrap: Promise<void> | null;
};
// Next's development compiler can load this module separately for each route.
// Keep one cache across those bundles and hot reloads, scoped to the data source.
const globals = globalThis as typeof globalThis & {
  __bluffMarkets?: Map<string, MarketState>;
};
const states = (globals.__bluffMarkets ??= new Map());
function marketState(): MarketState {
  const key = `${GEMINI_BASE}:${process.env.GEMINI_OFFLINE ?? "0"}`;
  if (!states.has(key))
    states.set(key, { cache: null, pending: null, bootstrap: null });
  return states.get(key)!;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ruleText(c: any): string {
  const d = c?.description;
  if (!d || typeof d !== "object") return "";
  return (
    (d.content ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((n: any) => n?.value ?? "")
      .join(" ")
      .slice(0, 500)
  );
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
  // One deadline covers the entire scan, including response bodies.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const pageAt = async (offset: number) => {
    const url = `${GEMINI_BASE}/v1/prediction-markets/events?status=active&limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    return res.json();
  };
  try {
    const first = await pageAt(0);
    const out: GEvent[] = (first.data ?? []).map(normalizeEvent);
    const total = Number(first.pagination?.total);
    const end =
      Number.isFinite(total) && total > 0 ? Math.min(total, 5000) : 5000;
    if (out.length < PAGE_SIZE || out.length >= end) return out;
    for (
      let offset = PAGE_SIZE;
      offset < end;
      offset += PAGE_SIZE * PAGE_CONCURRENCY
    ) {
      const offsets = Array.from(
        {
          length: Math.min(
            PAGE_CONCURRENCY,
            Math.ceil((end - offset) / PAGE_SIZE),
          ),
        },
        (_, i) => offset + i * PAGE_SIZE,
      );
      const pages = await Promise.all(offsets.map(pageAt));
      for (const body of pages) {
        const page = body.data ?? [];
        out.push(...page.map(normalizeEvent));
        if (page.length < PAGE_SIZE) return out;
      }
    }
    return out;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

async function loadSnapshot(): Promise<MarketUniverse> {
  const file = path.join(process.cwd(), "data", "gemini-snapshot.json");
  const raw = JSON.parse(await fs.readFile(file, "utf8"));
  return {
    events: raw.events.map(normalizeEvent),
    source: "snapshot",
    fetchedAt: raw.fetchedAt,
  };
}

async function refreshMarkets(state: MarketState): Promise<void> {
  try {
    const events = await fetchLive();
    state.cache = {
      at: Date.now(),
      data: { events, source: "live", fetchedAt: new Date().toISOString() },
    };
  } catch (err) {
    console.warn(
      "[gemini] refresh failed, retaining cached markets:",
      (err as Error).message,
    );
    // Back off after an outage without discarding the last usable catalog.
    if (state.cache) state.cache.at = Date.now();
  }
}

export async function getMarkets(): Promise<MarketUniverse> {
  const state = marketState();
  if (!state.cache) {
    // Cold requests only read local data. A network scan must never gate a page
    // render or checkout quote, even after a restart or a development rebuild.
    state.bootstrap ??= loadSnapshot()
      .then((data) => {
        state.cache ??= { at: 0, data };
      })
      .finally(() => {
        state.bootstrap = null;
      });
    await state.bootstrap;
  }
  if (
    process.env.GEMINI_OFFLINE !== "1" &&
    Date.now() - state.cache!.at >= TTL_MS &&
    !state.pending
  ) {
    state.pending = refreshMarkets(state).finally(() => {
      state.pending = null;
    });
  }
  return state.cache!.data;
}

/** Look up settlement for one event ticker (used by the settlement oracle). */
export async function getEventByTicker(ticker: string): Promise<GEvent | null> {
  try {
    const res = await fetch(
      `${GEMINI_BASE}/v1/prediction-markets/events/${encodeURIComponent(ticker)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(4_000),
      },
    );
    if (!res.ok) return null;
    const body = await res.json();
    return normalizeEvent(body.data ?? body);
  } catch {
    return null;
  }
}

/** Checkout waits for fresh event books; catalog rendering stays instant. */
export async function getPricingMarkets(tickers: string[]): Promise<MarketUniverse> {
  const cached = await getMarkets();
  if (process.env.GEMINI_OFFLINE === "1" || !tickers.length)
    return { ...cached, source: "snapshot" };
  const fresh = await Promise.all([...new Set(tickers)].map(getEventByTicker));
  // Never describe an outage fallback or an incomplete refresh as live data.
  if (fresh.some((e, i) => !e || e.ticker !== [...new Set(tickers)][i]))
    return { ...cached, source: "snapshot" };
  return { events: fresh as GEvent[], source: "live", fetchedAt: new Date().toISOString() };
}
