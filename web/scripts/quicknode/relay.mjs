import http from "node:http";
import { pathToFileURL } from "node:url";

/** Expose just the signed webhook, never the storefront, orders or console.
 * Bind this relay to loopback and point a tunnel at it, not at Next.js directly.
 * @param {number} upstreamPort
 */
export function createWebhookRelay(upstreamPort = 3000) {
  return http.createServer({ requestTimeout: 20_000, headersTimeout: 10_000 }, (req, res) => {
    if (req.url !== "/api/webhooks/quicknode") {
      res.writeHead(404).end(); req.resume(); return;
    }
    if (req.method !== "GET" && req.method !== "POST") {
      res.writeHead(405, { Allow: "GET, POST" }).end(); req.resume(); return;
    }
    if (req.method === "POST" && (!req.headers["x-qn-signature"] || !req.headers["x-qn-nonce"] || !req.headers["x-qn-timestamp"])) {
      res.writeHead(401).end(); req.resume(); return;
    }
    const headers = {};
    for (const name of ["content-type", "content-encoding", "x-qn-nonce", "x-qn-signature", "x-qn-timestamp"]) {
      if (req.headers[name]) headers[name] = req.headers[name];
    }
    const upstream = http.request({ hostname: "127.0.0.1", port: upstreamPort, path: "/api/webhooks/quicknode", method: req.method, headers, timeout: 15_000 }, response => {
      res.writeHead(response.statusCode ?? 502, { "content-type": response.headers["content-type"] ?? "application/json", "cache-control": "no-store" });
      response.pipe(res);
    });
    upstream.on("timeout", () => upstream.destroy());
    upstream.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > 1_048_576) { res.writeHead(413).end(); upstream.destroy(); req.destroy(); return; }
      if (!upstream.write(chunk)) req.pause();
    });
    upstream.on("drain", () => req.resume());
    req.on("end", () => upstream.end());
    req.on("aborted", () => upstream.destroy());
    req.on("error", () => upstream.destroy());
    res.on("close", () => upstream.destroy());
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.STREAM_RELAY_PORT ?? "3102");
  const target = Number(process.env.STREAM_RELAY_TARGET_PORT ?? "3000");
  if (![port, target].every(n => Number.isInteger(n) && n > 0 && n <= 65535)) throw new Error("Invalid relay port");
  const server = createWebhookRelay(target);
  server.listen(port, "127.0.0.1", () => console.log(`Webhook-only relay: http://127.0.0.1:${port}/api/webhooks/quicknode`));
  const close = () => server.close(() => process.exit(0));
  process.once("SIGTERM", close); process.once("SIGINT", close);
}
