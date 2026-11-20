export type VaultEventName =
  | "PolicyPurchased"
  | "PolicySettled"
  | "MarketSettled"
  | "HedgeProceedsDeposited";
export interface VaultEvent {
  id: string;
  chainId: number;
  vault: string;
  name: VaultEventName;
  policyId?: string;
  marketRef: string;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  blockNumber: number;
  blockHash: string;
  blockTimestamp: number;
  args: Record<string, string | boolean>;
}
export interface StreamBlock {
  number: number;
  hash: string;
  timestamp: number;
}
export interface VaultBatch {
  streamId: string;
  network: string;
  chainId: number;
  vault: string;
  fromBlock: number;
  toBlock: number;
  blocks: StreamBlock[];
  events: VaultEvent[];
  orphanedBlocks: { number: number; hash: string }[];
}
export interface DeliveryResult {
  duplicate: boolean;
  eventsInserted: number;
  eventsRemoved: number;
  fromBlock: number;
  toBlock: number;
}
export interface ChainProof {
  source: "quicknode";
  state: "active" | "paid" | "expired";
  purchase?: VaultEvent;
  settlement?: VaultEvent;
}
export interface StoredActivity extends VaultEvent {
  receivedAt: string;
  canonical: boolean;
}
export interface StreamSnapshot {
  deliveries: number;
  events: number;
  orphanedEvents: number;
  lastDeliveryAt: string | null;
  lastBlock: number | null;
  recent: StoredActivity[];
}
