import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { sportsEventFrom } from "../src/lib/catalog";
import { buildCoverages } from "../src/lib/coverage";
import { enabledCoverages, eventsWithCoverage } from "../src/lib/offer-availability";
import type { OfferConfig } from "../src/lib/store";
import type { MarketUniverse } from "../src/lib/gemini/types";

const universe: MarketUniverse = { ...JSON.parse(fs.readFileSync("data/gemini-snapshot.json", "utf8")), source: "snapshot" };
const game = sportsEventFrom(universe.events.find((event) => event.ticker === "NBA-2611220030-POR-NYK-M")!)!;
const coverages = buildCoverages(universe, game);
const offer: OfferConfig = { eventId: game.id, published: true, coverages: { "team-loses": { enabled: true, refundPct: 15 }, "star-sits": { enabled: true, refundPct: 35 } }, updatedAt: new Date().toISOString() };

test("buyer catalog includes every configured event with enabled coverage, without a two-event cap", () => {
  const games = Array.from({ length: 5 }, (_, i) => ({ ...game, id: `game-${i}` }));
  const offers = Object.fromEntries(games.map((event) => [event.id, { ...offer, eventId: event.id }]));
  assert.equal(eventsWithCoverage(games, offers, universe).length, 5);
  offers[games[1].id] = { ...offers[games[1].id], published: false };
  offers[games[3].id] = { ...offers[games[3].id], coverages: { "team-loses": { enabled: false, refundPct: 15 } } };
  delete offers[games[4].id];
  assert.deepEqual(eventsWithCoverage(games, offers, universe).map((event) => event.id), ["game-0", "game-2"]);
});

test("active coverage requires a supported provider and ignores disabled and unknown offerings", () => {
  assert.deepEqual(enabledCoverages(game, coverages, offer).map((coverage) => coverage.id), ["team-loses", "star-sits"]);
  assert.deepEqual(enabledCoverages(game, coverages, { ...offer, coverages: {
    "team-loses": { enabled: true, refundPct: 15, providers: { gemini: false, kalshi: true } },
    "star-sits": { enabled: true, refundPct: 35, providers: { gemini: false, kalshi: true } },
    cold: { enabled: true, refundPct: 50 },
  } }).map((coverage) => coverage.id), ["team-loses"], "Kalshi can supply NBA heartbreak coverage, but cannot supply the star-sits proxy");
  assert.equal(enabledCoverages(game, coverages, { ...offer, coverages: { "team-loses": { enabled: true, refundPct: 15, providers: { gemini: false, kalshi: false } } } }).length, 0);
  assert.equal(enabledCoverages(game, coverages, { ...offer, published: false }).length, 0);
  assert.equal(enabledCoverages(game, coverages).length, 0);
});
