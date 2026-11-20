import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { openStore } from "../src/lib/store";
import { createStreamsWebhook } from "../src/lib/quicknode/webhook";
import { parseVaultBatch } from "../src/lib/quicknode/events";
import { buildVaultFilter } from "../src/lib/quicknode/filter";
import {
  block,
  config,
  hash,
  payload,
  policy,
  signedRequest,
} from "./helpers/streams-fixtures";

function fixture(t: { after: (fn: () => void) => void }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bluff-streams-"));
  const file = path.join(dir, "test.sqlite");
  const store = openStore(file);
  t.after(() => {
    try {
      store.close();
    } catch {}
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return {
    store,
    file,
    dir,
    handle: createStreamsWebhook(() => config, store),
  };
}
test("only fresh, authentic, scoped deliveries can change policies", async (t) => {
  const { store, handle } = fixture(t);
  store.addPolicy(policy());
  for (const req of [
    signedRequest(payload(), { secret: "wrong" }),
    signedRequest(payload(), {
      timestamp: String(Math.floor(Date.now() / 1000) - 360),
    }),
    signedRequest(payload(), {
      timestamp: String(Math.floor(Date.now() / 1000) + 360),
    }),
  ])
    assert.equal((await handle(req)).status, 401);
  const tampered = signedRequest(payload());
  const raw = await tampered.text();
  assert.equal(
    (
      await handle(
        new Request(tampered.url, {
          method: "POST",
          headers: tampered.headers,
          body: raw.replace('"version":1', '"version":2'),
        }),
      )
    ).status,
    401,
  );
  const wrongChain = payload();
  wrongChain.chainId = 1;
  assert.equal((await handle(signedRequest(wrongChain))).status, 400);
  const wrongStream = payload();
  wrongStream.metadata.stream_id = "unapproved-stream";
  assert.equal((await handle(signedRequest(wrongStream))).status, 400);
  assert.equal(store.policy(policy().id)?.status, "pending");
  assert.equal(store.streamSnapshot().events, 0);
});
test("unconfigured receiver fails closed; malformed and oversized signed payloads are rejected", async (t) => {
  const { store, handle } = fixture(t);
  t.mock.method(console, "error", () => {});
  assert.equal(
    (
      await createStreamsWebhook(
        () => ({ ...config, enabled: false }),
        store,
      )(signedRequest(payload()))
    ).status,
    503,
  );
  assert.equal(
    (
      await createStreamsWebhook(
        () => ({ ...config, secret: "" }),
        store,
      )(signedRequest(payload()))
    ).status,
    503,
  );
  assert.equal(
    (
      await createStreamsWebhook(
        () => ({ ...config, streamId: "" }),
        store,
      )(signedRequest(payload()))
    ).status,
    503,
  );
  assert.equal(
    (await handle(new Request("http://local", { method: "POST", body: "{}" })))
      .status,
    401,
  );
  const short = signedRequest(payload());
  short.headers.set("X-QN-Signature", "ab");
  assert.equal((await handle(short)).status, 401);
  assert.equal(
    (await handle(signedRequest(null, { raw: "not json" }))).status,
    400,
  );
  assert.equal(
    (
      await handle(
        signedRequest(null, {
          raw: '{"oversized":"' + "x".repeat(1_048_576) + '"}',
        }),
      )
    ).status,
    413,
  );
  const badGzip = signedRequest(payload());
  badGzip.headers.set("content-encoding", "gzip");
  assert.equal((await handle(badGzip)).status, 400);
  assert.equal(store.streamSnapshot().deliveries, 0);
});
test("gzip uses the exact uncompressed string; retries and re-signed historical events are idempotent", async (t) => {
  const { store, handle } = fixture(t);
  store.addPolicy(policy());
  const body = payload();
  const raw = JSON.stringify(body, null, 2);
  const first = await handle(
    signedRequest(body, { nonce: "same-delivery", gzip: true, raw }),
  );
  assert.equal(first.status, 200);
  assert.equal((await first.json()).eventsInserted, 1);
  const p = store.policy(policy().id)!;
  assert.equal(p.status, "active");
  assert.equal(p.chain?.source, "quicknode");
  assert.equal(p.arc.txHash, body.blocks[0].logs[0].transactionHash);
  const retry = await handle(
    signedRequest(body, {
      nonce: "same-delivery",
      raw,
      timestamp: String(Math.floor(Date.now() / 1000) - 1000),
    }),
  );
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).duplicate, true);
  const replay = await handle(signedRequest(body));
  assert.equal((await replay.json()).eventsInserted, 0);
  const conflict = await handle(
    signedRequest(payload([block(11)]), { nonce: "same-delivery" }),
  );
  assert.equal(conflict.status, 409);
  assert.equal(store.streamSnapshot().events, 1);
  assert.equal(store.streamSnapshot().deliveries, 2);
});
test("payout confirmation survives process/database restart and blocks duplicate settlement submission", async (t) => {
  const { store, file, handle } = fixture(t);
  store.addPolicy(policy());
  await handle(signedRequest(payload()));
  const second = openStore(file);
  t.after(() => second.close());
  assert.equal(store.claimSettlement([policy().id]), true);
  assert.equal(second.claimSettlement([policy().id]), false);
  assert.equal(second.policy(policy().id)?.status, "settling");
  const settled = payload([block(20, "paid")]);
  assert.equal((await handle(signedRequest(settled))).status, 200);
  assert.equal(second.policy(policy().id)?.status, "paid");
  assert.equal(
    second.policy(policy().id)?.chain?.settlement?.args.paid,
    "519000",
  );
  const reopened = openStore(file);
  assert.equal(reopened.policy(policy().id)?.status, "paid");
  reopened.close();
  assert.equal(store.claimSettlement([policy().id]), false);
});
test("events arriving before an order and out-of-order backfills recover the right final state", async (t) => {
  const { store, handle } = fixture(t);
  await handle(signedRequest(payload([block(30, "paid")])));
  assert.equal(
    store.policies().length,
    0,
    "public chain events must not invent customer orders",
  );
  store.addPolicy(policy());
  assert.equal(store.policy(policy().id)?.status, "paid");
  await handle(signedRequest(payload([block(10, "purchase")])));
  assert.equal(
    store.policy(policy().id)?.status,
    "paid",
    "older purchase must not overwrite newer settlement",
  );
  assert.equal(
    store.policy(policy().id)?.arc.txHash,
    block(10).logs[0].transactionHash,
  );
  await handle(signedRequest(payload([block(5, "empty")])));
  assert.equal(
    store.streamSnapshot().lastBlock,
    30,
    "backfill must not rewind health cursor",
  );
});
test("replacement blocks remove orphaned payouts, including replacements with no vault logs", async (t) => {
  const { store, handle } = fixture(t);
  store.addPolicy(policy());
  await handle(signedRequest(payload([block(10), block(20, "paid")])));
  assert.equal(store.policy(policy().id)?.status, "paid");
  const replacement = payload([block(20, "empty", undefined, "b")]);
  replacement.metadata.reorgs = [
    { block_number: 20, block_hash: block(20, "paid").hash },
  ];
  replacement.metadata.blocks_reorged = [20];
  await handle(signedRequest(replacement));
  assert.equal(store.policy(policy().id)?.status, "active");
  assert.equal(store.streamSnapshot().orphanedEvents, 1);
  await handle(signedRequest(payload([block(20, "paid")])));
  assert.equal(
    store.policy(policy().id)?.status,
    "active",
    "a re-signed replay cannot resurrect an orphaned payout",
  );
  await handle(signedRequest(payload([block(21, "expired", undefined, "b")])));
  assert.equal(store.policy(policy().id)?.status, "expired");
});
test("backfill cannot mask a missing primary stream or downgrade a legacy final receipt", async (t) => {
  const { store } = fixture(t);
  const legacy = policy();
  legacy.confirmationMode = "receipt";
  legacy.status = "paid";
  store.addPolicy(legacy);
  const historical = payload();
  historical.metadata.stream_id = "approved-backfill";
  const handler = createStreamsWebhook(
    () => ({ ...config, backfillStreamIds: ["approved-backfill"] }),
    store,
  );
  assert.equal((await handler(signedRequest(historical))).status, 200);
  assert.equal(store.policy(legacy.id)?.status, "paid");
  assert.equal(store.streamSnapshot(config.streamId).lastDeliveryAt, null);
  assert.equal(store.streamSnapshot().events, 1);
});
test("source address, ABI encoding and market reference are checked before projecting state", async (t) => {
  const { store, handle } = fixture(t);
  store.addPolicy(policy());
  const unrelated = payload();
  unrelated.blocks[0].logs[0].address = "0x" + "1".repeat(40);
  assert.equal((await handle(signedRequest(unrelated))).status, 200);
  assert.equal(store.policy(policy().id)?.status, "pending");
  const malformed = payload([block(11)]);
  malformed.blocks[0].logs[0].data = "0xdead";
  assert.equal((await handle(signedRequest(malformed))).status, 400);
  assert.equal(store.streamSnapshot().events, 0);
  const wrongMarket = payload([block(12)]);
  wrongMarket.blocks[0].logs[0].topics[3] = hash("different coverage");
  assert.equal((await handle(signedRequest(wrongMarket))).status, 200);
  assert.equal(store.policy(policy().id)?.status, "pending");
  const simulated = policy("pol_simulated", "simulated");
  store.addPolicy(simulated);
  await handle(signedRequest(payload([block(15, "paid", simulated.id)])));
  assert.equal(store.policy(simulated.id)?.status, "active");
  assert.equal(store.policy(simulated.id)?.chain, undefined);
});
test("database failure returns retryable status and commits no acknowledgement", async (t) => {
  const { store } = fixture(t);
  t.mock.method(console, "error", () => {});
  const failing = createStreamsWebhook(() => config, {
    delivery: store.delivery,
    ingest: () => {
      throw new Error("disk failure");
    },
  });
  assert.equal(
    (await failing(signedRequest(payload(), { nonce: "retry-after-restart" })))
      .status,
    503,
  );
  assert.equal(store.streamSnapshot().deliveries, 0);
  const healthy = createStreamsWebhook(() => config, store);
  assert.equal(
    (await healthy(signedRequest(payload(), { nonce: "retry-after-restart" })))
      .status,
    200,
  );
  assert.equal(store.streamSnapshot().events, 1);
});
test("legacy JSON migrates exactly once without changing or deleting the original file", (t) => {
  const { file, dir } = fixture(t);
  const other = path.join(dir, "migration.sqlite"),
    legacy = path.join(dir, "db.json");
  const source = {
    policies: [policy("legacy", "simulated")],
    offers: {},
    customEvents: [],
  };
  fs.writeFileSync(legacy, JSON.stringify(source));
  const first = openStore(other, legacy);
  assert.equal(first.policies().length, 1);
  first.addPolicy(policy("new-order", "simulated"));
  first.close();
  const second = openStore(other, legacy);
  assert.equal(second.policies().length, 2);
  second.close();
  assert.deepEqual(JSON.parse(fs.readFileSync(legacy, "utf8")), source);
  const corrupt = path.join(dir, "corrupt.json");
  fs.writeFileSync(corrupt, "broken");
  assert.throws(() => openStore(file + "-corrupt", corrupt));
});
test("the actual sandbox filter keeps vault receipts and empty-block heartbeats", () => {
  const fixtureBlock = block(10);
  const log = fixtureBlock.logs[0];
  const run = vm.runInNewContext(
    buildVaultFilter(config.vault, config.chainId) + "; main",
  );
  const input = {
    metadata: payload().metadata,
    data: [
      {
        block: {
          number: "0xa",
          hash: fixtureBlock.hash,
          timestamp: fixtureBlock.timestamp,
        },
        receipts: [
          {
            status: "0x1",
            transactionHash: log.transactionHash,
            transactionIndex: 0,
            logs: [log, { ...log, address: "0x" + "1".repeat(40) }],
          },
          { status: "0x0", logs: [log] },
        ],
      },
    ],
  };
  const filtered = JSON.parse(JSON.stringify(run(input)));
  const parsed = parseVaultBatch(filtered, config);
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.blocks.length, 1);
  input.data[0].receipts = [];
  const heartbeat = JSON.parse(JSON.stringify(run(input)));
  assert.equal(parseVaultBatch(heartbeat, config).events.length, 0);
  assert.equal(heartbeat.blocks.length, 1);
});
