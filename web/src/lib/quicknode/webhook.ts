import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { DeliveryConflict, type Store } from "../store";
import { InvalidStreamPayload, parseVaultBatch } from "./events";
import type { streamConfig } from "./config";

type Config = ReturnType<typeof streamConfig>;
const MAX_BYTES = 1_048_576;
class WebhookError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function decodedBody(req: Request) {
  if (
    !req.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new WebhookError(415, "Expected application/json");
  const reader = req.body?.getReader();
  if (!reader) throw new WebhookError(400, "Missing payload");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new WebhookError(413, "Payload too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let bytes = Buffer.concat(chunks);
  const encoding = req.headers.get("content-encoding")?.toLowerCase();
  if (encoding && encoding !== "identity") {
    if (encoding !== "gzip")
      throw new WebhookError(415, "Unsupported content encoding");
    try {
      bytes = gunzipSync(bytes, { maxOutputLength: MAX_BYTES });
    } catch {
      throw new WebhookError(400, "Invalid or oversized gzip payload");
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new WebhookError(400, "Expected UTF-8 JSON");
  }
}
export function createStreamsWebhook(
  getConfig: () => Config,
  store: Pick<Store, "delivery" | "ingest">,
) {
  return async function POST(req: Request): Promise<Response> {
    try {
      const config = getConfig();
      if (!config.enabled || config.secret.length < 32 || !config.streamId)
        throw new WebhookError(503, "QuickNode Streams is not configured");
      const nonce = req.headers.get("x-qn-nonce") ?? "";
      const timestamp = req.headers.get("x-qn-timestamp") ?? "";
      const signature = req.headers.get("x-qn-signature") ?? "";
      if (
        !/^[\x21-\x7e]{1,256}$/.test(nonce) ||
        !/^\d{10,13}$/.test(timestamp) ||
        !/^[a-f0-9]{64}$/i.test(signature)
      )
        throw new WebhookError(401, "Invalid webhook authentication");
      const payload = await decodedBody(req);
      // QuickNode signs the uncompressed UTF-8 JSON, not JSON.stringify(parsed).
      // https://www.quicknode.com/guides/quicknode-products/streams/validating-incoming-streams-webhook-messages
      const expected = createHmac("sha256", config.secret)
        .update(nonce + timestamp + payload)
        .digest();
      if (!timingSafeEqual(expected, Buffer.from(signature, "hex")))
        throw new WebhookError(401, "Invalid webhook signature");
      let input: unknown;
      try {
        input = JSON.parse(payload);
      } catch {
        throw new WebhookError(400, "Invalid JSON");
      }
      const batch = parseVaultBatch(input, config);
      const deliveryId = `${batch.streamId}:${nonce}`;
      const fingerprint = createHash("sha256").update(payload).digest("hex");
      // Previously committed retries may be acknowledged after the freshness
      // window. They cannot execute work again or change a stored payload.
      const existing = store.delivery(deliveryId, fingerprint);
      if (existing)
        return Response.json(existing, {
          headers: { "Cache-Control": "no-store" },
        });
      const time = Number(timestamp) * (timestamp.length <= 10 ? 1000 : 1);
      if (Math.abs(Date.now() - time) > 300_000)
        throw new WebhookError(
          401,
          "Webhook timestamp is outside the five-minute window",
        );
      return Response.json(store.ingest(batch, deliveryId, fingerprint), {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      const status =
        error instanceof WebhookError
          ? error.status
          : error instanceof InvalidStreamPayload
            ? 400
            : error instanceof DeliveryConflict
              ? 409
              : 503;
      const message =
        status === 503
          ? "Stream delivery could not be committed; retry later"
          : (error as Error).message;
      if (status === 503)
        console.error(
          "[quicknode] delivery unavailable:",
          error instanceof WebhookError
            ? error.message
            : "database unavailable",
        );
      return Response.json(
        { error: message },
        { status, headers: { "Cache-Control": "no-store" } },
      );
    }
  };
}
