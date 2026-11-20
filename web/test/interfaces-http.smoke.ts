import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { buildCatalog } from "../src/lib/catalog";
import { buildCoverages } from "../src/lib/coverage";

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bluff-interfaces-"));
  const listener = net.createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const port = (listener.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  const origin = `http://127.0.0.1:${port}`;
  let child: ChildProcess | undefined;
  let logs = "";
  async function start(mode: "business" | "customer") {
    logs = "";
    child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
      env: { ...process.env, BLUFF_INTERFACE: mode, GEMINI_OFFLINE: "1", KALSHI_OFFLINE: "1", BLUFF_DB_PATH: path.join(dir, "orders.sqlite"), BLUFF_LEGACY_DB_PATH: path.join(dir, "none.json") },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (data) => (logs += data));
    child.stderr?.on("data", (data) => (logs += data));
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error(logs);
      try { if ((await fetch(origin, { redirect: "manual", signal: AbortSignal.timeout(1000) })).status === 307) return; } catch {}
      await delay(100);
    }
    throw new Error(`Interface server did not start: ${logs}`);
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
  async function redirected(route: string, target: string) {
    const response = await fetch(origin + route, { redirect: "manual" });
    assert.ok([307, 308].includes(response.status), `${route}: ${response.status}`);
    assert.equal(new URL(response.headers.get("location")!, origin).pathname, target);
  }
  try {
    await start("customer");
    await redirected("/", "/tickets");
    await redirected("/console", "/tickets");
    await redirected("/console/contracts", "/tickets");
    await redirected("/demo", "/tickets");
    await redirected("/tickets/checkout", "/tickets");
    const empty = await (await fetch(origin + "/tickets")).text();
    assert.ok(!empty.includes('href="/tickets/checkout?event='), "unconfigured events are not listed");
    const universe = { ...JSON.parse(fs.readFileSync("data/gemini-snapshot.json", "utf8")), source: "snapshot" as const };
    const configured = buildCatalog(universe).filter((event) => buildCoverages(universe, event).length > 0).slice(0, 4);
    assert.equal(configured.length, 4);
    for (const event of configured) {
      const coverage = buildCoverages(universe, event)[0];
      const saved = await fetch(origin + "/api/offers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: event.id, published: true, coverages: { [coverage.id]: { enabled: true, refundPct: coverage.defaultRefundPct } } }) });
      assert.equal(saved.status, 200);
    }
    const browse = await (await fetch(origin + "/tickets")).text();
    assert.ok(browse.includes("Customer navigation"));
    assert.ok(!/href="\/console/.test(browse));
    const links = [...browse.matchAll(/href="(\/tickets\/checkout\?event=[^"]+)"/g)].map((match) => match[1]);
    assert.equal(links.length, 4, "every event with enabled coverage is listed, without a two-event limit");
    for (const link of links) {
      const checkout = await (await fetch(origin + link.replaceAll("&amp;", "&"))).text();
      assert.ok(checkout.includes("Confirm order"), "unpublished protection does not block ticket checkout");
      assert.ok(!/href="\/console/.test(checkout), "customer pages do not link to business controls");
    }
    const paused = configured[0];
    const coverage = buildCoverages(universe, paused)[0];
    assert.equal((await fetch(origin + "/api/offers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: paused.id, published: false, coverages: { [coverage.id]: { enabled: false, refundPct: coverage.defaultRefundPct } } }) })).status, 200);
    const afterPause = await (await fetch(origin + "/tickets")).text();
    assert.ok(!afterPause.includes(`href="/tickets/checkout?event=${paused.id}"`), "disabled coverage removes the event from ticket browsing");
    assert.equal([...afterPause.matchAll(/href="(\/tickets\/checkout\?event=[^"]+)"/g)].length, 3);
    await stop();
    await start("business");
    await redirected("/", "/console");
    await redirected("/tickets", "/console");
    await redirected("/demo/checkout?event=nba", "/console");
    const dashboard = await (await fetch(origin + "/console")).text();
    assert.ok(dashboard.includes("Business navigation"));
    assert.ok(!/href="\/(tickets|demo|seatwise)/.test(dashboard));
    const event = await (await fetch(origin + "/console/events/nba-2611220030-por-nyk")).text();
    assert.ok(event.includes("Review contracts"));
    assert.ok(!/href="\/(tickets|demo|seatwise)/.test(event), "event workflow stays in the business interface");
    console.log("PASS: independent interfaces, all four configured events listed, disabled coverage removed, and customer-only checkout navigation.");
  } finally {
    await stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
