import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import net from "node:net";
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
          GEMINI_OFFLINE: "1",
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
    assert.ok(draft.includes("Protection is not published yet"));
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
    assert.ok(checkout.includes("Complete demo purchase"));
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
    const responses = await Promise.all([
      post("/api/policies", order),
      post("/api/policies", order),
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
    assert.ok(detail.includes("Resolve demo outcome"));
    assert.ok(detail.includes("Gemini hedge"));
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
      ).includes("Demo paid out"),
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
    const second = await post("/api/policies", {
      ...order,
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
    console.log(
      "PASS: draft → publish → checkout → idempotent contract → business totals → demo payout / no-payout → durable ledger. Configured credentials never execute, and live contracts remain untouched.",
    );
  } finally {
    await stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
