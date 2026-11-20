import { createHmac, randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import {
  encodeAbiParameters,
  encodeEventTopics,
  keccak256,
  parseAbiParameters,
  toHex,
} from "viem";
import { vaultEventsAbi } from "../../src/lib/quicknode/events";
import deployment from "../../src/lib/arc/deployment.json";
import type { Policy } from "../../src/lib/store";

export const testSecret = "test-only-stream-token-000000000000000000000000";
export const config = {
  enabled: true,
  secret: testSecret,
  streamId: "bluff-test-stream",
  backfillStreamIds: [] as string[],
  network: "arc-testnet",
  chainId: deployment.chainId,
  vault: deployment.address.toLowerCase(),
};
export const hash = (value: string) => keccak256(toHex(value));
export const marketRef = "NBA-2611220030-POR-NYK-M:team-loses";
export function policy(
  id = "pol_stream_fixture",
  mode: "live" | "simulated" = "live",
): Policy {
  return {
    id,
    createdAt: new Date().toISOString(),
    eventId: "nba-2611220030-por-nyk",
    eventTitle: "Portland Trail Blazers at New York Knicks",
    eventStart: "2026-11-22T00:30:00.000Z",
    venue: "Madison Square Garden",
    coverageId: "team-loses",
    coverageName: "Heartbreak Cover",
    emoji: "",
    trigger: "Knicks lose",
    hedgeType: "full",
    holderName: "Stream Test",
    holderEmail: "stream-test@example.test",
    tierName: "Lower Level",
    qty: 2,
    ticketTotal: 346,
    refundPct: 15,
    payout: 51.9,
    premium: 22.43,
    hedgeLeg: {
      eventTicker: "NBA-2611220030-POR-NYK-M",
      instrumentSymbol: "fixture",
      outcome: "yes",
      price: 0.35,
      contractLabel: "Portland",
      hedgeType: "full",
    } as unknown as Policy["hedgeLeg"],
    hedge: {
      mode: "simulated",
      order: {
        symbol: "fixture",
        orderType: "limit",
        side: "buy",
        outcome: "yes",
        quantity: "51.90",
        price: "0.35",
      },
      orderId: "fixture",
      status: "filled",
      filledQuantity: "51.90",
      avgPrice: "0.35",
      cost: 18.17,
    },
    arc: { mode, policyIdHex: hash(id), marketRefHex: hash(marketRef) },
    status: mode === "live" ? "pending" : "active",
    confirmationMode: mode === "live" ? "stream" : "simulated",
  };
}
export function block(
  number: number,
  kind: "purchase" | "paid" | "expired" | "empty" = "purchase",
  id = "pol_stream_fixture",
  fork = "a",
) {
  const blockHash = hash(`block-${number}-${fork}`),
    transactionHash = hash(`tx-${number}-${fork}`);
  let topics: unknown[] = [],
    data = "0x";
  if (kind === "purchase") {
    topics = encodeEventTopics({
      abi: vaultEventsAbi,
      eventName: "PolicyPurchased",
      args: {
        policyId: hash(id),
        holder: deployment.operator as `0x${string}`,
        marketRef: hash(marketRef),
      },
    });
    data = encodeAbiParameters(
      parseAbiParameters("uint256,uint256,uint64,string"),
      [BigInt(224300), BigInt(519000), BigInt(1800000000), "Knicks lose"],
    );
  } else if (kind !== "empty") {
    topics = encodeEventTopics({
      abi: vaultEventsAbi,
      eventName: "PolicySettled",
      args: { policyId: hash(id), marketRef: hash(marketRef) },
    });
    data = encodeAbiParameters(parseAbiParameters("bool,uint256"), [
      kind === "paid",
      kind === "paid" ? BigInt(519000) : BigInt(0),
    ]);
  }
  return {
    number,
    hash: blockHash,
    timestamp: 1795160000 + number,
    logs:
      kind === "empty"
        ? []
        : [
            {
              address: config.vault,
              topics,
              data,
              blockNumber: number,
              blockHash,
              transactionHash,
              transactionIndex: 0,
              logIndex: 0,
            },
          ],
  };
}
export function payload(blocks = [block(10)]) {
  return {
    version: 1,
    chainId: config.chainId,
    vault: config.vault,
    metadata: {
      stream_id: config.streamId,
      network: config.network,
      dataset: "block_with_receipts",
      batch_start_range: Math.min(...blocks.map((b) => b.number)),
      batch_end_range: Math.max(...blocks.map((b) => b.number)),
      reorgs: [] as { block_number: number; block_hash: string }[],
      blocks_reorged: [] as number[],
    },
    blocks,
  };
}
export function signedRequest(
  body: unknown,
  options: {
    nonce?: string;
    timestamp?: string;
    secret?: string;
    gzip?: boolean;
    raw?: string;
  } = {},
) {
  const raw = options.raw ?? JSON.stringify(body);
  const nonce = options.nonce ?? randomUUID();
  const timestamp = options.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", options.secret ?? testSecret)
    .update(nonce + timestamp + raw)
    .digest("hex");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-QN-Nonce": nonce,
    "X-QN-Timestamp": timestamp,
    "X-QN-Signature": signature,
  };
  if (options.gzip) headers["Content-Encoding"] = "gzip";
  return new Request("http://localhost/api/webhooks/quicknode", {
    method: "POST",
    headers,
    body: options.gzip ? new Uint8Array(gzipSync(raw)) : raw,
  });
}
