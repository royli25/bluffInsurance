import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import net from "node:net";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { openStore } from "../src/lib/store";
import { policy } from "./helpers/streams-fixtures";

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bluff-demo-http-"));
  const file = path.join(dir, "demo.sqlite");
  const store = openStore(file);
  const live = {
    ...policy("live-control"),
    status: "active" as const,
    confirmationMode: "receipt" as const,
  };
  store.addPolicy(live);
  store.close();
  const listener = net.createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const port = (listener.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  const origin = `http://127.0.0.1:${port}`;
  let compareProviders = false;
  let unexpectedWrites = 0;
  const provider = createServer((req, res) => {
    if (req.method !== "GET") unexpectedWrites++;
    const route = req.url ?? "";
    const body = route.includes("/exchange/status") ? { exchange_active: true, trading_active: true } : route.includes("fee_changes") ? { event_fee_changes: [], cursor: "" } : route.includes("/series/") ? { series: { fee_type: "quadratic", fee_multiplier: 1 } } : route.includes("orderbook") ? { orderbook_fp: { no_dollars: [["0.80", "10000"]] } } : {
      event: { event_ticker: "KXNBAGAME-26NOV21PORNYK", series_ticker: "KXNBAGAME", product_metadata: { competition_scope: "Game" } },
      markets: [{ ticker: "KXNBAGAME-26NOV21PORNYK-POR", event_ticker: "KXNBAGAME-26NOV21PORNYK", market_type: "binary", status: "active", yes_sub_title: "Portland", notional_value_dollars: "1", close_time: "2099-01-01", result: "", rules_primary: "If Portland wins the Portland vs New York Pro Basketball game originally scheduled for Nov 21, 2026, then the market resolves to Yes." }],
    };
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(body));
  });
  provider.listen(0, "127.0.0.1"); await once(provider, "listening");
  const providerOrigin = `http://127.0.0.1:${(provider.address() as net.AddressInfo).port}`;
  let child: ChildProcess | undefined;
  let output = "";
  async function start() {
    output = "";
    child = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: "production",
          NEXT_BUILD_DIR: process.env.NEXT_BUILD_DIR ?? ".next-streams",
          BLUFF_DB_PATH: file,
          BLUFF_LEGACY_DB_PATH: path.join(dir, "no-legacy.json"),
          GEMINI_OFFLINE: "1", KALSHI_OFFLINE: compareProviders ? "0" : "1",
          KALSHI_API_BASE: providerOrigin + "/trade-api/v2",
          // Credentials deliberately look configured. Any failure to force demo
          // execution will hit an invalid local URL/key, never a real trade.
          GEMINI_API_BASE: origin + "/forbidden-external",
          GEMINI_API_KEY: "test-only-not-real",
          GEMINI_API_SECRET: "test-only-not-real",
          ARC_OPERATOR_KEY: "not-a-private-key",
          QUICKNODE_STREAMS_ENABLED: "1",
          QUICKNODE_STREAM_ID: "",
          QUICKNODE_STREAM_SECURITY_TOKEN: "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.stdout?.on("data", (chunk) => (output += chunk));
    child.stderr?.on("data", (chunk) => (output += chunk));
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error(output);
      try {
        if (
          (
            await fetch(origin + "/api/policies", {
              signal: AbortSignal.timeout(1000),
            })
          ).ok
        )
          return;
      } catch {}
      await delay(200);
    }
    throw new Error(`Server failed to start: ${output}`);
  }
  async function stop() {
    if (!child || child.exitCode !== null) return;
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    const timer = setTimeout(() => child?.kill("SIGKILL"), 5000);
    await exited;
    clearTimeout(timer);
    child = undefined;
  }
  async function post(route: string, body: unknown) {
    const r = await fetch(origin + route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() };
  }
  async function policies() {
    return (await (await fetch(origin + "/api/policies")).json())
      .policies as ReturnType<typeof policy>[];
  }
  async function metric(name: string) {
    const html = await (await fetch(origin + "/console")).text();
    const value = html.match(
      new RegExp(`data-metric="${name}"[^>]*>([^<]+)<`),
    )?.[1];
    assert.ok(value, `Missing ${name} metric`);
    return value;
  }
  const eventId = "nba-2611220030-por-nyk";
  const order = {
    eventId,
    coverageId: "team-loses",
    tierId: "upper",
    qty: 2,
    holderName: "Demo Customer",
    holderEmail: "demo@example.test",
    demo: true,
    requestId: randomUUID(),
  };
  try {
    await start();
    assert.equal(
      (await fetch(origin + "/", { redirect: "manual" })).status,
      307,
    );
    const draft = await (
      await fetch(origin + `/demo/checkout?event=${eventId}`)
    ).text();
    assert.ok(draft.includes("Protection is not published yet") || draft.includes("Confirm order"), draft.slice(0, 500) + output);
    assert.equal((await post("/api/quotes", { eventId, tierId: order.tierId, qty: order.qty })).status, 400, "unpublished protection cannot be quoted");
    assert.equal((await post("/api/policies", order)).status, 400);
    assert.equal(
      (
        await post("/api/offers", {
          eventId,
          published: true,
          coverages: { "team-loses": { enabled: true, refundPct: -5 } },
        })
      ).status,
      400,
    );
    assert.equal(
      (await post("/api/offers", { eventId, published: true, coverages: {} }))
        .status,
      400,
    );
    assert.equal(
      (
        await post("/api/offers", {
          eventId,
          published: true,
          coverages: { "team-loses": { enabled: true, refundPct: 15 } },
        })
      ).status,
      200,
    );
    const checkout = await (
      await fetch(origin + `/demo/checkout?event=${eventId}`)
    ).text();
    assert.ok(checkout.includes("Confirm order"));
    assert.equal(
      (
        await post("/api/policies", {
          ...order,
          coverageId: "blowout",
          requestId: randomUUID(),
        })
      ).status,
      400,
      "unpublished cover cannot be bought",
    );
    assert.equal((await post("/api/policies", order)).status, 400, "demo requires a server quote");
    let quoted = await post("/api/quotes", { eventId, tierId: order.tierId, qty: order.qty });
    assert.equal(quoted.status, 200, JSON.stringify(quoted.body));
    assert.equal(quoted.body.quote.source, "estimate", "offline never claims live prices");
    assert.equal(quoted.body.quote.options.length, 1);
    assert.equal((await post("/api/offers", { eventId, published: true, coverages: { "team-loses": { enabled: true, refundPct: 15, providers: { gemini: false, kalshi: false } } } })).status, 400);
    assert.equal((await post("/api/offers", { eventId, published: true, coverages: { "team-loses": { enabled: true, refundPct: 15, providers: { unknown: true } } } })).status, 400);
    const changedProvider = await post("/api/offers", { eventId, published: true, coverages: { "team-loses": { enabled: true, refundPct: 15, providers: { gemini: true, kalshi: false } } } });
    assert.equal(changedProvider.status, 200);
    assert.equal(changedProvider.body.offer.coverages["team-loses"].providers.kalshi, false);
    assert.equal((await post("/api/policies", { ...order, quoteId: quoted.body.quote.id })).status, 400, "provider changes invalidate outstanding quotes");
    const staleSave = await post("/api/offers", { eventId, published: true, expectedUpdatedAt: "stale", coverages: { "team-loses": { enabled: true, refundPct: 15 } } });
    assert.equal(staleSave.status, 400, "concurrent stale settings cannot overwrite provider choices");
    quoted = await post("/api/quotes", { eventId, tierId: order.tierId, qty: order.qty });
    const quotedOrder = { ...order, quoteId: quoted.body.quote.id };
    assert.equal((await post("/api/policies", { ...quotedOrder, qty: 3 })).status, 400, "quote binds ticket count");
    const responses = await Promise.all([
      post("/api/policies", quotedOrder),
      post("/api/policies", quotedOrder),
    ]);
    for (const r of responses)
      assert.ok(r.status === 200 || r.status === 202, JSON.stringify(r.body));
    assert.equal(
      new Set(responses.map((r) => r.body.policy.id)).size,
      1,
      "concurrent retry must not create two contracts",
    );
    let rows = await policies();
    assert.equal(rows.length, 2);
    const created = rows.find((p) => p.id !== live.id)!;
    assert.equal(created.premium, quoted.body.quote.options[0].price.premium, "purchase must use exact accepted price");
    assert.equal((await post("/api/policies", { ...quotedOrder, requestId: randomUUID() })).status, 400, "one quote cannot create two orders");
    assert.equal(created.status, "active");
    assert.equal(created.arc.mode, "simulated");
    assert.equal(created.hedge.mode, "simulated");
    assert.equal(created.chain, undefined);
    assert.equal(
      (await post("/api/policies", { ...order, qty: 3 })).status,
      400,
      "same key with different order cannot silently reuse a contract",
    );
    assert.equal(await metric("active"), "2");
    assert.equal(await metric("events"), "1");
    const premiums = await metric("premiums");
    const detail = await (
      await fetch(origin + `/console/contracts/${created.id}`)
    ).text();
    assert.ok(detail.includes("Resolve outcome"));
    assert.ok(detail.includes("Gemini") && detail.includes("hedge"));
    assert.ok(
      !detail.includes(`href="${created.arc.explorerUrl}"`),
      "mock transaction must not link to a real explorer",
    );
    const settlement = await post("/api/settle", {
      eventId,
      coverageId: "team-loses",
      triggered: true,
      demo: true,
    });
    assert.equal(settlement.status, 200);
    assert.equal(settlement.body.settled, 1);
    rows = await policies();
    assert.equal(rows.find((p) => p.id === created.id)?.status, "paid");
    assert.equal(
      rows.find((p) => p.id === live.id)?.status,
      "active",
      "demo control must never settle a live policy",
    );
    assert.equal(await metric("active"), "1");
    assert.equal(
      await metric("premiums"),
      premiums,
      "payout must not erase collected premiums",
    );
    assert.ok(
      (
        await (await fetch(origin + `/console/contracts/${created.id}`)).text()
      ).includes("Paid out"),
    );
    assert.equal(
      (
        await post("/api/settle", {
          eventId,
          coverageId: "team-loses",
          triggered: true,
          demo: true,
        })
      ).body.settled,
      0,
    );
    const nextQuote = (await post("/api/quotes", { eventId, tierId: order.tierId, qty: order.qty })).body.quote;
    // Quotes are persisted separately from orders and survive process restarts.
    await stop();
    await start();
    const second = await post("/api/policies", {
      ...order,
      quoteId: nextQuote.id,
      requestId: randomUUID(),
    });
    assert.equal(second.status, 200);
    assert.equal(
      (
        await post("/api/settle", {
          eventId,
          coverageId: "team-loses",
          triggered: false,
          demo: true,
        })
      ).body.settled,
      1,
    );
    assert.equal(
      (await policies()).find((p) => p.id === second.body.policy.id)?.status,
      "expired",
    );
    await stop();
    await start();
    assert.equal(
      (await policies()).find((p) => p.id === created.id)?.status,
      "paid",
    );
    await stop(); compareProviders = true; await start();
    await post("/api/offers", { eventId, published: true, coverages: { "team-loses": { enabled: true, refundPct: 15, providers: { gemini: true, kalshi: true } } } });
    const routedQuote = await post("/api/quotes", { eventId, tierId: "upper", qty: 2 });
    assert.equal(routedQuote.status, 200, JSON.stringify(routedQuote.body));
    const selectedRoute = routedQuote.body.quote.options[0];
    assert.equal(selectedRoute.provider, "kalshi", "fresh matching Kalshi book beats indicative Gemini fallback");
    assert.equal(selectedRoute.comparison.length, 2);
    const routedPurchase = await post("/api/policies", { ...order, requestId: randomUUID(), quoteId: routedQuote.body.quote.id });
    assert.equal(routedPurchase.status, 200, JSON.stringify(routedPurchase.body));
    assert.equal(routedPurchase.body.policy.hedgeLeg.provider, "kalshi");
    assert.equal(routedPurchase.body.policy.hedge.mode, "simulated");
    assert.match(routedPurchase.body.policy.hedge.order.symbol, /^KXNBAGAME-/);
    assert.equal(routedPurchase.body.policy.premium, selectedRoute.price.premium);
    const disable = await post("/api/offers", { eventId, published: true, coverages: { "team-loses": { enabled: true, refundPct: 15, providers: { gemini: true, kalshi: false } } } });
    assert.equal(disable.status, 200);
    assert.equal((await post("/api/policies", { ...order, requestId: randomUUID(), quoteId: routedQuote.body.quote.id })).status, 400);
    const switched = await post("/api/quotes", { eventId, tierId: "upper", qty: 2 });
    assert.equal(switched.body.quote.options[0].provider, "gemini", "disabled Kalshi cannot be chosen even when cheaper");
    const payout = await post("/api/settle", { eventId, coverageId: "team-loses", triggered: true, demo: true });
    assert.equal(payout.body.settled, 1);
    await stop(); await start();
    const stored = (await policies()).find((p) => p.id === routedPurchase.body.policy.id)!;
    assert.equal(stored.status, "paid");
    assert.equal(stored.hedgeLeg.provider, "kalshi");
    assert.equal(unexpectedWrites, 0, "market comparison must never submit orders to the data provider");
    console.log(
      "PASS: draft → publish → checkout → idempotent contract → business totals → demo payout / no-payout → durable ledger. Configured credentials never execute, and live contracts remain untouched.",
    );
  } finally {
    await stop();
    await new Promise<void>((resolve) => provider.close(() => resolve()));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
