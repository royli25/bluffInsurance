import { test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { getMarkets, getPricingMarkets } from "../src/lib/gemini/client";

test("cold pages and quotes render before Gemini completes, then share live refreshes across reloads", async (t) => {
  let now = Date.now();
  let requests = 0;
  let active = 0;
  let maxActive = 0;
  let fail = false;
  let release: (() => void) | undefined;
  let gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const signals = new Set<AbortSignal | null | undefined>();
  t.mock.method(Date, "now", () => now);
  t.mock.method(console, "warn", () => {});
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, init?: RequestInit) => {
      requests++;
      active++;
      maxActive = Math.max(maxActive, active);
      signals.add(init?.signal);
      await gate;
      await setImmediate();
      active--;
      if (fail) throw new Error("upstream unavailable");
      const offset = Number(new URL(url).searchParams.get("offset"));
      return Response.json({
        data: Array.from({ length: Math.min(100, 1003 - offset) }, (_, i) => ({
          id: offset + i,
          contracts: [],
        })),
        pagination: { total: 1003 },
      });
    },
  );
  const previousOffline = process.env.GEMINI_OFFLINE;
  delete process.env.GEMINI_OFFLINE;
  async function eventually(predicate: () => boolean) {
    for (let i = 0; i < 200; i++) {
      if (predicate()) return;
      await setImmediate();
    }
    assert.fail("background market refresh did not complete");
  }
  try {
    const result = await Promise.race([
      Promise.all([getMarkets(), getMarkets(), getMarkets()]),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(
          () => reject(new Error("cold render blocked on Gemini")),
          500,
        );
        timer.unref();
      }),
    ]);
    const [a, b, c] = result;
    assert.strictEqual(a, b);
    assert.strictEqual(b, c);
    assert.equal(
      a.source,
      "snapshot",
      "cold render uses local data while network is blocked",
    );
    assert.ok(a.events.length > 900);
    assert.equal(
      requests,
      1,
      "concurrent cold pages/quotes share one background scan",
    );
    release!();
    await eventually(() => requests === 11 && active === 0);
    await setImmediate();
    const live = await getMarkets();
    assert.equal(live.source, "live");
    assert.equal(live.events.length, 1003);
    assert.equal(maxActive, 4);
    assert.equal(signals.size, 1, "all pages share the scan deadline");
    assert.deepEqual(
      live.events.map((e) => e.id),
      Array.from({ length: 1003 }, (_, i) => String(i)),
    );

    // A separately evaluated route module must use the same process-wide cache.
    const secondRoute = await import(
      "../src/lib/gemini/client?route=quote" as string
    );
    assert.strictEqual(await secondRoute.getMarkets(), live);
    assert.equal(requests, 11, "route reload must not trigger another scan");

    now += 60_001;
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    assert.strictEqual(
      await getMarkets(),
      live,
      "expired data renders immediately",
    );
    assert.strictEqual(await getMarkets(), live);
    assert.equal(requests, 12, "stale readers share one refresh");
    fail = true;
    release!();
    await setImmediate();
    await setImmediate();
    assert.strictEqual(
      await getMarkets(),
      live,
      "outage retains last live data",
    );
    assert.equal(
      requests,
      12,
      "failure backs off instead of causing a retry storm",
    );
  } finally {
    release?.();
    if (previousOffline === undefined) delete process.env.GEMINI_OFFLINE;
    else process.env.GEMINI_OFFLINE = previousOffline;
  }
});

test("checkout bypasses catalog cache for fresh books and labels outage/offline fallbacks", async (t) => {
  const offline = process.env.GEMINI_OFFLINE;
  delete process.env.GEMINI_OFFLINE;
  let price = "0.40";
  let fail = false;
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    assert.ok(String(url).endsWith("/events/QUOTE-TEST"));
    assert.equal(init?.cache, "no-store");
    assert.ok(init?.signal);
    requests++;
    if (fail) return new Response("unavailable", { status: 503 });
    return Response.json({ data: { id: "quote", ticker: "QUOTE-TEST", contracts: [{ prices: { buy: { yes: price } } }] } });
  });
  try {
    const first = await getPricingMarkets(["QUOTE-TEST", "QUOTE-TEST"]);
    assert.equal(first.source, "live");
    assert.equal(first.events[0].contracts[0].prices.buy?.yes, "0.40");
    assert.equal(requests, 1, "duplicate hedge tickers share a request");
    price = "0.55";
    const second = await getPricingMarkets(["QUOTE-TEST"]);
    assert.equal(second.events[0].contracts[0].prices.buy?.yes, "0.55", "new quote must fetch the changed price");
    fail = true;
    assert.equal((await getPricingMarkets(["QUOTE-TEST"])).source, "snapshot");
    process.env.GEMINI_OFFLINE = "1";
    const before = requests;
    assert.equal((await getPricingMarkets(["QUOTE-TEST"])).source, "snapshot");
    assert.equal(requests, before);
  } finally {
    if (offline === undefined) delete process.env.GEMINI_OFFLINE;
    else process.env.GEMINI_OFFLINE = offline;
  }
});
