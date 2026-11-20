import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCoverages, quote, PRICING } from "../src/lib/coverage";
import { sportsEventFrom } from "../src/lib/catalog";
import type { MarketUniverse } from "../src/lib/gemini/types";

const raw = JSON.parse(fs.readFileSync("data/gemini-snapshot.json", "utf8"));
const u: MarketUniverse = { events: raw.events, source: "snapshot", fetchedAt: raw.fetchedAt };
const ml = (root: string) => u.events.find((e) => e.ticker === `${root}-M` || (e.ticker.startsWith(root) && !e.title.includes(":")))!;

test("snapshot has the expected market universe", () => {
  assert.ok(u.events.length > 900);
  assert.ok(u.events.some((e) => e.category === "Weather"));
});

test("full hedge: contracts = payout, premium = cost*(1+m)+fee", () => {
  const ev = sportsEventFrom(ml("NFL-2611260100-GB-LAR"))!;
  const c = buildCoverages(u, ev, "home").find((x) => x.id === "team-loses")!;
  assert.equal(c.hedge.outcome, "yes");
  assert.match(c.hedge.instrumentSymbol, /-M-GB$/); // Rams fan -> buy Green Bay YES
  const q = quote(c, 150, 50);
  assert.equal(q.payout, 75);
  assert.equal(q.contracts, 75);
  assert.equal(q.hedgeCost, Math.round(75 * c.hedge.price * 100) / 100);
  assert.ok(Math.abs(q.premium - Math.max(PRICING.minPremium, q.hedgeCost * (1 + PRICING.margin) + PRICING.fee)) < 0.011);
  assert.ok(q.premium > q.hedgeCost, "never sell below hedge cost");
});

test("rooting for away flips the hedge side", () => {
  const ev = sportsEventFrom(ml("NFL-2611260100-GB-LAR"))!;
  const c = buildCoverages(u, ev, "away").find((x) => x.id === "team-loses")!;
  assert.match(c.hedge.instrumentSymbol, /-M-LAR$/);
});

test("game-day NBA markets produce blowout / snoozer covers on the right side", () => {
  // live game at snapshot time: moneyline closed, spread + totals still open
  const spreadEv = u.events.find((e) => e.ticker === "NBA-2611200100-GSW-MEM-S")!;
  const ev = sportsEventFrom(spreadEv)!;
  assert.equal(ev.marketRoot, "NBA-2611200100-GSW-MEM");
  const fanSide = ev.home!.abbr === "GSW" ? "home" : "away";
  const covs = buildCoverages(u, ev, fanSide); // Warriors fan
  const blow = covs.find((c) => c.id === "blowout")!;
  assert.ok(blow, "blowout cover found");
  assert.match(blow.hedge.contractLabel, /^Memphis wins by more than/);
  assert.equal(blow.hedge.outcome, "yes");
  const sn = covs.find((c) => c.id === "snoozer");
  if (sn) assert.equal(sn.hedge.outcome, "no");
});

test("weather covers for concerts use the city's daily-high market", () => {
  const wx = u.events.find((e) => e.ticker.startsWith("WXHIGH-AUS"))!;
  const ev = { id: "c", kind: "concert" as const, title: "x", subtitle: "", league: "Concert", venue: "v", city: "Austin", startTime: new Date().toISOString(), weatherTicker: wx.ticker, tiers: [], heroFrom: "", heroTo: "" };
  const covs = buildCoverages(u, ev);
  assert.ok(covs.length >= 1);
  for (const c of covs) assert.equal(c.hedge.eventTicker, wx.ticker);
});

test("minimum premium floor applies", () => {
  const wx = u.events.find((e) => e.ticker.startsWith("WXHIGH-AUS"))!;
  const ev = { id: "c", kind: "concert" as const, title: "x", subtitle: "", league: "Concert", venue: "v", city: "Austin", startTime: "", weatherTicker: wx.ticker, tiers: [], heroFrom: "", heroTo: "" };
  for (const c of buildCoverages(u, ev)) assert.ok(quote(c, 10, 10).premium >= PRICING.minPremium);
});
