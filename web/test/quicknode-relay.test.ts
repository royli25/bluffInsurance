import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createWebhookRelay } from "../scripts/quicknode/relay.mjs";

test("public relay exposes only the signed webhook and preserves exact signed bytes", async () => {
  let received = 0;
  const upstream = http.createServer((req, res) => {
    received++; let body = "";
    req.on("data", c => body += c);
    req.on("end", () => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ body, signature: req.headers["x-qn-signature"], cookie: req.headers.cookie ?? null })); });
  });
  upstream.listen(0, "127.0.0.1"); await once(upstream, "listening");
  const relay = createWebhookRelay((upstream.address() as AddressInfo).port);
  relay.listen(0, "127.0.0.1"); await once(relay, "listening");
  const url = `http://127.0.0.1:${(relay.address() as AddressInfo).port}`;
  try {
    for (const route of ["/", "/api/policies", "/api/reset", "/console", "/api/streams", "/api/webhooks/quicknode?path=/api/reset"]) assert.equal((await fetch(url + route)).status, 404);
    assert.equal((await fetch(url + "/api/webhooks/quicknode", { method: "DELETE" })).status, 405);
    assert.equal((await fetch(url + "/api/webhooks/quicknode", { method: "POST", body: "{}" })).status, 401);
    assert.equal(received, 0);
    const raw = '{ "exact":  true }\n';
    const response = await fetch(url + "/api/webhooks/quicknode", { method: "POST", body: raw, headers: { "Content-Type": "application/json", "X-QN-Signature": "fixture-signature", "X-QN-Nonce": "fixture-nonce", "X-QN-Timestamp": "1795160000", Cookie: "private=never-forward" } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { body: raw, signature: "fixture-signature", cookie: null });
    assert.equal(received, 1);
  } finally {
    await new Promise<void>(resolve => relay.close(() => resolve()));
    await new Promise<void>(resolve => upstream.close(() => resolve()));
  }
});
