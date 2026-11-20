import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCoverages } from "../src/lib/coverage";
import { sportsEventFrom } from "../src/lib/catalog";
import { parseLevels, priceBook, selectBest } from "../src/lib/markets/pricing";
import { getKalshiBook, kalshiMatch } from "../src/lib/kalshi/client";
import { getGeminiBook } from "../src/lib/gemini/book";
import type { ProviderBook } from "../src/lib/markets/types";
const raw = JSON.parse(fs.readFileSync("data/gemini-snapshot.json", "utf8"));
const universe = { ...raw, source: "snapshot" as const };
const event = sportsEventFrom(universe.events.find((e: { ticker: string }) => e.ticker === "NBA-2611220030-POR-NYK-M"))!;
const coverage = buildCoverages(universe, event).find((c) => c.id === "team-loses")!;
const book = (provider: "gemini" | "kalshi", price: number): ProviderBook => ({ provider, asks: [{ price, quantity: 1000 }], observedAt: new Date().toISOString(), symbol: provider === "kalshi" ? "KXNBAGAME-26NOV21PORNYK-POR" : coverage.hedge.instrumentSymbol, feeRate: .07 });

test("best provider changes with the full premium, respects switches, and never prefers a stale estimate", () => {
  const g = priceBook(coverage, 200, book("gemini", .45));
  const k = priceBook(coverage, 200, book("kalshi", .35));
  assert.equal(selectBest([g, k])?.provider, "kalshi");
  assert.equal(selectBest([g, k], { kalshi: false })?.provider, "gemini");
  assert.equal(selectBest([g, k], { kalshi: false, gemini: false }), undefined);
  const improved = priceBook(coverage, 200, book("gemini", .25));
  assert.equal(selectBest([improved, k])?.provider, "gemini");
  assert.equal(selectBest([{ ...improved, state: "estimate" }, k])?.provider, "kalshi");
  assert.equal(selectBest([g, { ...k, state: "unavailable", price: undefined }])?.provider, "gemini");
});
test("book pricing includes depth, fees, staleness, and the actual venue ticker", () => {
  const shallow = { ...book("kalshi", .10), asks: [{ price: .1, quantity: 1 }, { price: .7, quantity: 100 }] };
  const k = priceBook(coverage, 200, shallow);
  const g = priceBook(coverage, 200, book("gemini", .4));
  assert.equal(selectBest([g, k])?.provider, "gemini", "cheap top ask cannot hide slippage");
  assert.ok(k.exchangeFee! > 0);
  assert.equal(k.coverage!.hedge.provider, "kalshi");
  assert.equal(k.coverage!.hedge.instrumentSymbol, shallow.symbol);
  assert.equal(k.coverage!.hedge.eventTicker, coverage.hedge.eventTicker, "Arc coverage identity remains venue-independent");
  assert.equal(priceBook(coverage, 200, { ...shallow, asks: [{ price: .1, quantity: 1 }] }).state, "unavailable");
  assert.equal(priceBook(coverage, 200, { ...shallow, observedAt: new Date(Date.now() - 16_000).toISOString() }).state, "unavailable");
  assert.equal(priceBook(coverage, 200, { ...shallow, feeRate: NaN }).state, "unavailable");
  assert.deepEqual(parseLevels([[".66", "12"], [".60", "5"], ["bad", "100"], [".7", "0"]], true), [{ price: .34, quantity: 12 }, { price: .4, quantity: 5 }]);
});
test("Kalshi matches the New York local game date, opposing winner, fees and full live book", async (t) => {
  const previous = process.env.GEMINI_OFFLINE; delete process.env.GEMINI_OFFLINE;
  let broken = false;
  let fail = false;
  const match = kalshiMatch(event, "home")!;
  assert.equal(match.symbol, "KXNBAGAME-26NOV21PORNYK-POR");
  assert.equal(kalshiMatch(event, "away")!.symbol, "KXNBAGAME-26NOV21PORNYK-NYK");
  assert.equal(kalshiMatch({ ...event, league: "NFL" }, "home"), null);
  t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.equal(new URL(url).hostname, new URL(process.env.KALSHI_API_BASE ?? "https://external-api.kalshi.com").hostname);
    if (fail) throw new Error("outage");
    if (String(url).includes("/exchange/status")) return Response.json({ exchange_active: true, trading_active: true });
    if (String(url).includes("fee_changes")) return Response.json({ event_fee_changes: [], cursor: "" });
    if (String(url).includes("/series/")) return Response.json({ series: { fee_type: "quadratic_with_maker_fees", fee_multiplier: 1 } });
    if (String(url).includes("/orderbook")) return Response.json({ orderbook_fp: { no_dollars: [[".66", "400"]] } });
    return Response.json({ event: { event_ticker: match.event, series_ticker: "KXNBAGAME", product_metadata: { competition_scope: "Game" } }, markets: [{ ticker: match.symbol, event_ticker: match.event, market_type: "binary", status: "active", yes_sub_title: broken ? "San Antonio" : "Portland", notional_value_dollars: "1", close_time: "2099-01-01", result: "", rules_primary: `If Portland wins the Portland vs New York Pro Basketball game originally scheduled for ${match.dateLabel}, then the market resolves to Yes.` }] });
  });
  try {
    const result = await getKalshiBook(event, "home");
    assert.equal(result?.asks[0].price, .34);
    assert.equal(result?.asks[0].quantity, 400);
    broken = true; assert.equal(await getKalshiBook(event, "home"), null, "wrong team must not match");
    broken = false; fail = true; assert.equal(await getKalshiBook(event, "home"), null);
  } finally { if (previous === undefined) delete process.env.GEMINI_OFFLINE; else process.env.GEMINI_OFFLINE = previous; }
});
test("Gemini public snapshot parses YES-space asks and complementary NO bids and closes its socket", async () => {
  const previous = process.env.GEMINI_OFFLINE; delete process.env.GEMINI_OFFLINE;
  let closed = 0;
  class Socket {
    onopen: (() => void) | null = null; onmessage: ((e: { data: string }) => void) | null = null;
    onerror = null; onclose = null;
    constructor() { queueMicrotask(() => this.onopen?.()); }
    send(raw: string) {
      const data = JSON.parse(raw); assert.equal(data.method, "SUBSCRIBE");
      queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ symbol: coverage.hedge.instrumentSymbol.toLowerCase(), asks: [[".4", "100"]], bids: [[".3", "200"]] }) }));
    }
    close() { closed++; }
  }
  const originalSocket = globalThis.WebSocket;
  globalThis.WebSocket = Socket as unknown as typeof WebSocket;
  try {
    assert.deepEqual((await getGeminiBook(coverage.hedge.instrumentSymbol, "yes"))?.asks, [{ price: .4, quantity: 100 }]);
    assert.deepEqual((await getGeminiBook(coverage.hedge.instrumentSymbol, "no"))?.asks, [{ price: .7, quantity: 200 }]);
    assert.equal(closed, 2);
  } finally { globalThis.WebSocket = originalSocket; if (previous === undefined) delete process.env.GEMINI_OFFLINE; else process.env.GEMINI_OFFLINE = previous; }
});
