import "server-only";
import crypto from "node:crypto";
import { GEMINI_BASE } from "./client";

/**
 * Hedge executor. Places the offsetting order on Gemini Prediction Markets.
 *
 * LIVE mode: set GEMINI_API_KEY + GEMINI_API_SECRET + GEMINI_LIVE_HEDGE=1 (key must have NewOrder
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
  timeInForce?: "good-til-cancel" | "immediate-or-cancel" | "fill-or-kill";
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

// Live orders spend real funds, so keys alone are not enough: GEMINI_LIVE_HEDGE=1
// is the explicit switch, and removing it returns every hedge to simulation.
export const hedgeMode = (): "live" | "simulated" =>
  process.env.GEMINI_API_KEY && process.env.GEMINI_API_SECRET && process.env.GEMINI_LIVE_HEDGE === "1"
    ? "live"
    : "simulated";

// Gemini rejects a nonce that repeats or goes backwards, and prediction-market
// endpoints reject one sent as a string.
let lastNonce = 0;
const nextNonce = () => (lastNonce = Math.max(Date.now(), lastNonce + 1));

/** Master (account-group) keys must name the account on every request. */
const accountScope = (key: string): { account?: string } => {
  const account = process.env.GEMINI_ACCOUNT ?? (key.startsWith("master-") ? "primary" : undefined);
  return account ? { account } : {};
};

async function privateRequest(method: "GET" | "POST", endpoint: string, body: Record<string, unknown>) {
  const key = process.env.GEMINI_API_KEY!;
  const secret = process.env.GEMINI_API_SECRET!;
  const payload = { request: endpoint, nonce: nextNonce(), ...accountScope(key), ...body };
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  const sig = crypto.createHmac("sha384", secret).update(b64).digest("hex");
  const res = await fetch(`${GEMINI_BASE}${endpoint}`, {
    method,
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

const privatePost = (endpoint: string, body: Record<string, unknown>) =>
  privateRequest("POST", endpoint, body);

export async function placeHedge(
  order: HedgeOrder,
  simulate = false,
): Promise<HedgeFill> {
  if (!simulate && hedgeMode() === "live") {
    const status = await privateRequest(
      "GET",
      "/v1/prediction-markets/terms/status",
      {},
    ).catch(() => null);
    if (status && status.hasAcceptedLatest === false) {
      await privatePost("/v1/prediction-markets/terms/accept", {});
    }
    // Fill-or-kill: the policy is either fully hedged at the quoted price or not
    // sold. A resting or partial order would leave Bluff carrying the risk.
    const raw = await privatePost("/v1/prediction-markets/order", { ...order, timeInForce: order.timeInForce ?? "fill-or-kill" });
    const filled = String(raw.filledQuantity ?? raw.executedQuantity ?? "0");
    if (!(Number(filled) >= Number(order.quantity)))
      throw new Error("The hedge could not be filled at the quoted price. Refresh prices before purchasing.");
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
