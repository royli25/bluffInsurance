/** Isolated production-server smoke test. Fixtures are synthetic, not real
 * QuickNode deliveries or evidence of an onchain payout. No external trades.
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { openStore } from "../src/lib/store";
import {
  block,
  config,
  payload,
  policy,
  signedRequest,
} from "./helpers/streams-fixtures";

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bluff-streams-http-"));
  const file = path.join(dir, "app.sqlite");
  const store = openStore(file);
  store.addPolicy(policy());
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
          ARC_OPERATOR_KEY: "",
          ARC_VAULT_ADDRESS: config.vault,
          GEMINI_API_KEY: "",
          GEMINI_API_SECRET: "",
          GEMINI_OFFLINE: "1",
          QUICKNODE_STREAMS_ENABLED: "1",
          QUICKNODE_STREAM_SECURITY_TOKEN: config.secret,
          QUICKNODE_STREAM_ID: config.streamId,
          QUICKNODE_STREAM_NETWORK: config.network,
          QUICKNODE_BACKFILL_STREAM_IDS: "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.stdout?.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      output += chunk;
    });
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error(`Server exited: ${output}`);
      try {
        if (
          (
            await fetch(origin + "/api/webhooks/quicknode", {
              signal: AbortSignal.timeout(1000),
            })
          ).ok
        )
          return;
      } catch {}
      await delay(200);
    }
    throw new Error(`Server did not become ready: ${output}`);
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
  async function post(body: ReturnType<typeof payload>, nonce: string) {
    const req = signedRequest(body, { nonce, gzip: true });
    return fetch(origin + "/api/webhooks/quicknode", {
      method: "POST",
      headers: req.headers,
      body: await req.arrayBuffer(),
    });
  }
  async function currentPolicy() {
    const response = await fetch(origin + "/api/policies");
    assert.equal(response.status, 200);
    return (await response.json()).policies[0];
  }
  try {
    await start();
    assert.equal((await currentPolicy()).status, "pending");
    assert.equal(
      (
        await fetch(origin + "/api/webhooks/quicknode", {
          method: "POST",
          body: "{}",
        })
      ).status,
      401,
    );
    assert.equal((await post(payload(), "http-purchase")).status, 200);
    assert.equal((await currentPolicy()).status, "active");
    const pendingHtml = await (
      await fetch(origin + "/seatwise/account")
    ).text();
    assert.ok(
      pendingHtml.includes("Verified from Arc events via QuickNode Streams"),
    );
    assert.equal(
      (await post(payload([block(20, "paid")]), "http-settlement")).status,
      200,
    );
    assert.equal((await currentPolicy()).status, "paid");
    assert.equal((await currentPolicy()).chain.settlement.args.paid, "519000");
    const html = await (await fetch(origin + "/seatwise/account")).text();
    assert.ok(html.includes("Arc payout confirmed"));
    assert.ok(html.includes("0.519 USDC"));
    const health = await (await fetch(origin + "/api/streams")).json();
    assert.equal(health.status, "connected");
    assert.equal(health.events, 2);
    assert.equal(health.deliveries, 2);
    assert.ok(!JSON.stringify(health).includes(config.secret));
    const activity = await fetch(origin + "/console/activity");
    assert.equal(activity.status, 200);
    assert.ok((await activity.text()).includes("Policy settled"));
    await stop();
    await start();
    assert.equal(
      (await currentPolicy()).status,
      "paid",
      "full Node restart must preserve confirmed payout",
    );
    const retry = await post(payload([block(20, "paid")]), "http-settlement");
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);
    assert.equal(
      (await (await fetch(origin + "/api/streams")).json()).events,
      2,
    );
    console.log(
      "PASS: production HTTP signature → purchase → payout → account/activity UI → full server restart → deduplicated retry (isolated synthetic fixtures).",
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
