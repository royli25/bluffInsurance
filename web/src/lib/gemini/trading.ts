import "server-only";
import crypto from "node:crypto";
import { GEMINI_BASE } from "./client";

/**
 * Hedge executor. Places the offsetting order on Gemini Prediction Markets.
 *
 * LIVE mode: set GEMINI_API_KEY + GEMINI_API_SECRET (key must have NewOrder
 * permission and the account must have accepted prediction-market terms).
 * Requests use Gemini's standard private-API auth: base64 JSON payload +
 * HMAC-SHA384 signature headers.
 *
 * SIMULATED mode (default, no keys): we build the exact same order payload and
 * record a simulated fill at the quoted ask, so the whole flow is demoable.
 */
export interface HedgeOrder {
  symbol: string;
  orderType: "limit";
  side: "buy";
  outcome: "yes" | "no";
  quantity: string;
  price: string;
}

export interface HedgeFill {
  mode: "live" | "simulated";
  order: HedgeOrder;
  orderId: string;
  status: string;
  filledQuantity: string;
  avgPrice: string;
  cost: number;
  raw?: unknown;
}

export const hedgeMode = (): "live" | "simulated" =>
  process.env.GEMINI_API_KEY && process.env.GEMINI_API_SECRET
    ? "live"
    : "simulated";

async function privatePost(endpoint: string, body: Record<string, unknown>) {
  const key = process.env.GEMINI_API_KEY!;
  const secret = process.env.GEMINI_API_SECRET!;
  const payload = { request: endpoint, nonce: Date.now().toString(), ...body };
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  const sig = crypto.createHmac("sha384", secret).update(b64).digest("hex");
  const res = await fetch(`${GEMINI_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "Content-Length": "0",
      "X-GEMINI-APIKEY": key,
      "X-GEMINI-PAYLOAD": b64,
      "X-GEMINI-SIGNATURE": sig,
      "Cache-Control": "no-cache",
    },
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      `Gemini ${endpoint} ${res.status}: ${JSON.stringify(json)}`,
    );
  return json;
}

export async function placeHedge(
  order: HedgeOrder,
  simulate = false,
): Promise<HedgeFill> {
  if (!simulate && hedgeMode() === "live") {
    const status = await privatePost(
      "/v1/prediction-markets/terms/status",
      {},
    ).catch(() => null);
    if (status && status.hasAcceptedLatest === false) {
      await privatePost("/v1/prediction-markets/terms/accept", {});
    }
    const raw = await privatePost("/v1/prediction-markets/order", { ...order });
    const filled = String(raw.filledQuantity ?? raw.executedQuantity ?? "0");
    const avg = String(raw.avgExecutionPrice ?? raw.avgPrice ?? order.price);
    return {
      mode: "live",
      order,
      orderId: String(raw.orderId ?? raw.id ?? "unknown"),
      status: String(raw.status ?? "accepted"),
      filledQuantity: filled,
      avgPrice: avg,
      cost: Number(filled) * Number(avg),
      raw,
    };
  }
  const q = Number(order.quantity);
  const p = Number(order.price);
  return {
    mode: "simulated",
    order,
    orderId: `sim_${crypto.randomBytes(6).toString("hex")}`,
    status: "filled",
    filledQuantity: order.quantity,
    avgPrice: order.price,
    cost: Math.round(q * p * 100) / 100,
  };
}
