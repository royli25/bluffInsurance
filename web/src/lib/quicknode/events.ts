import { decodeEventLog, parseAbi, toEventSelector, type Hex } from "viem";
import type { VaultBatch, VaultEvent, VaultEventName } from "./types";

export const vaultEventsAbi = parseAbi([
  "event PolicyPurchased(bytes32 indexed policyId, address indexed holder, bytes32 indexed marketRef, uint256 premium, uint256 payout, uint64 expiry, string triggerText)",
  "event PolicySettled(bytes32 indexed policyId, bytes32 indexed marketRef, bool triggered, uint256 paid)",
  "event MarketSettled(bytes32 indexed marketRef, bool triggered, uint256 policiesSettled, uint256 totalPaid)",
  "event HedgeProceedsDeposited(bytes32 indexed marketRef, uint256 amount, address indexed from)",
]);
export const vaultEventTopics = vaultEventsAbi.map((e) =>
  toEventSelector(e).toLowerCase(),
);
export class InvalidStreamPayload extends Error {}
const invalid = (label: string): never => {
  throw new InvalidStreamPayload(`Invalid ${label}`);
};
export function record(value: unknown, label: string): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : invalid(label);
}
export function integer(value: unknown, label: string): number {
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || !/^(?:0x[0-9a-f]+|[0-9]+)$/i.test(value))
  )
    return invalid(label);
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : invalid(label);
}
function hex(value: unknown, bytes: number, label: string): string {
  return typeof value === "string" &&
    new RegExp(`^0x[0-9a-f]{${bytes * 2}}$`, "i").test(value)
    ? value.toLowerCase()
    : invalid(label);
}
function list(value: unknown, label: string): unknown[] {
  return Array.isArray(value) ? value : invalid(label);
}

/** Strict schema shared with the generated QuickNode filter. Decode ABI locally;
 * webhook strings such as `name: "PolicySettled"` are never treated as evidence.
 */
export function parseVaultBatch(
  input: unknown,
  expected: {
    chainId: number;
    vault: string;
    network: string;
    streamId?: string;
    backfillStreamIds?: string[];
  },
): VaultBatch {
  const body = record(input, "payload");
  if (body.version !== 1)
    invalid("filter version; use the supplied Bluff filter");
  const chainId = integer(body.chainId, "chain id");
  const vault = hex(body.vault, 20, "vault address");
  if (chainId !== expected.chainId || vault !== expected.vault.toLowerCase())
    invalid("chain or vault scope");
  const metadata = record(body.metadata, "stream metadata");
  if (
    metadata.network !== expected.network ||
    metadata.dataset !== "block_with_receipts"
  )
    invalid("network or dataset");
  const streamId = metadata.stream_id;
  if (typeof streamId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(streamId))
    invalid("stream id");
  if (
    expected.streamId &&
    expected.streamId !== streamId &&
    !expected.backfillStreamIds?.includes(streamId as string)
  )
    invalid("unexpected stream id");
  const fromBlock = integer(metadata.batch_start_range, "batch start");
  const toBlock = integer(metadata.batch_end_range, "batch end");
  if (toBlock < fromBlock) invalid("batch range");
  const sourceBlocks = list(body.blocks, "blocks");
  if (sourceBlocks.length > 1000) invalid("batch size");
  const blocks: VaultBatch["blocks"] = [];
  const events: VaultEvent[] = [];
  const seenBlocks = new Set<number>();
  for (const raw of sourceBlocks) {
    const block = record(raw, "block");
    const number = integer(block.number, "block number");
    const blockHash = hex(block.hash, 32, "block hash");
    const timestamp = integer(block.timestamp, "block timestamp");
    if (
      timestamp > 253402300799 ||
      number < fromBlock ||
      number > toBlock ||
      seenBlocks.has(number)
    )
      invalid("block range or timestamp");
    seenBlocks.add(number);
    blocks.push({ number, hash: blockHash, timestamp });
    for (const item of list(block.logs, "block logs")) {
      const log = record(item, "log");
      const address = hex(log.address, 20, "log address");
      if (address !== vault) continue;
      const topics = list(log.topics, "event topics").map((t) =>
        hex(t, 32, "event topic"),
      );
      if (!topics.length || !vaultEventTopics.includes(topics[0] as Hex))
        continue;
      if (log.removed === true)
        invalid("removed log; send replacement blocks with reorg metadata");
      if (
        log.blockHash !== undefined &&
        hex(log.blockHash, 32, "log block hash") !== blockHash
      )
        invalid("log block hash mismatch");
      if (
        log.blockNumber !== undefined &&
        integer(log.blockNumber, "log block number") !== number
      )
        invalid("log block number mismatch");
      const transactionHash = hex(log.transactionHash, 32, "transaction hash");
      const transactionIndex = integer(
        log.transactionIndex,
        "transaction index",
      );
      const logIndex = integer(log.logIndex, "log index");
      const data = log.data;
      if (typeof data !== "string" || !/^0x(?:[a-f0-9]{2})*$/i.test(data))
        invalid("event data");
      let decoded;
      try {
        decoded = decodeEventLog({
          abi: vaultEventsAbi,
          data: data as Hex,
          topics: topics as [Hex, ...Hex[]],
          strict: true,
        });
      } catch {
        return invalid("vault event encoding");
      }
      const args = Object.fromEntries(
        Object.entries(decoded.args).map(([key, value]) => [
          key,
          typeof value === "bigint"
            ? value.toString()
            : typeof value === "string" && value.startsWith("0x")
              ? value.toLowerCase()
              : value,
        ]),
      ) as Record<string, string | boolean>;
      events.push({
        id: `${chainId}:${vault}:${blockHash}:${transactionHash}:${logIndex}`,
        chainId,
        vault,
        name: decoded.eventName as VaultEventName,
        policyId: typeof args.policyId === "string" ? args.policyId : undefined,
        marketRef: String(args.marketRef),
        transactionHash,
        transactionIndex,
        logIndex,
        blockNumber: number,
        blockHash,
        blockTimestamp: timestamp,
        args,
      });
    }
  }
  const orphanedBlocks = (
    metadata.reorgs == null ? [] : list(metadata.reorgs, "reorgs")
  ).map((item) => {
    const entry = record(item, "orphaned block");
    return {
      number: integer(entry.block_number, "orphan block number"),
      hash: hex(entry.block_hash, 32, "orphan block hash"),
    };
  });
  // A heartbeat must contain block identities, including empty replacement blocks.
  // Otherwise a rollback could acknowledge a delivery without clearing old events.
  const reorgNumbers =
    metadata.blocks_reorged == null
      ? []
      : list(metadata.blocks_reorged, "reorg block numbers").map((n) =>
          integer(n, "reorg number"),
        );
  for (const number of reorgNumbers)
    if (!seenBlocks.has(number)) invalid("missing replacement block");
  return {
    streamId: streamId as string,
    network: expected.network,
    chainId,
    vault,
    fromBlock,
    toBlock,
    blocks,
    events,
    orphanedBlocks,
  };
}
