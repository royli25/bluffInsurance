import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { keccak256, toHex } from "viem";
import deployment from "./arc/deployment.json";
import type { MarketCandidate, ProviderSettings } from "./markets/types";
import type { CheckoutQuote } from "./checkout-quote";
import type { TicketEvent } from "./catalog";
import type { CoverageId, HedgeLeg } from "./coverage";
import type { HedgeFill } from "./gemini/trading";
import type { ArcReceipt } from "./arc/client";
import type {
  ChainProof,
  DeliveryResult,
  StoredActivity,
  StreamSnapshot,
  VaultBatch,
  VaultEvent,
} from "./quicknode/types";

export interface Policy {
  id: string;
  createdAt: string;
  eventId: string;
  eventTitle: string;
  eventStart: string;
  venue: string;
  coverageId: CoverageId;
  coverageName: string;
  emoji: string;
  trigger: string;
  hedgeType: "full" | "partial";
  holderName: string;
  holderEmail: string;
  tierName: string;
  qty: number;
  ticketTotal: number;
  refundPct: number;
  payout: number;
  premium: number;
  hedgeLeg: HedgeLeg;
  hedge: HedgeFill;
  arc: ArcReceipt;
  status: "pending" | "active" | "settling" | "paid" | "expired";
  quoteId?: string;
  marketComparison?: MarketCandidate[];
  confirmationMode?: "stream" | "receipt" | "simulated";
  settlementError?: string;
  purchaseError?: string;
  settledAt?: string;
  settlement?: { triggered: boolean; arc: ArcReceipt; hedgeProceeds: number };
  /** Derived from the canonical event journal on every read, never trusted from a local write. */
  chain?: ChainProof;
}
/** Version of an event's offer before it has ever been saved. Unsaved defaults carry it so the first save passes the version check. */
export const UNSAVED_OFFER_VERSION = new Date(0).toISOString();
export interface OfferConfig {
  eventId: string;
  published: boolean;
  coverages: Partial<
    Record<CoverageId, { enabled: boolean; refundPct: number; providers?: ProviderSettings }>
  >;
  updatedAt: string;
}
interface AppData {
  policies: Policy[];
  offers: Record<string, OfferConfig>;
  customEvents: TicketEvent[];
}
const empty = (): AppData => ({ policies: [], offers: {}, customEvents: [] });
const hash = (value: string) => keccak256(toHex(value));

export class DeliveryConflict extends Error {}

/** SQLite WAL makes a delivery, its event journal and its acknowledgement atomic.
 * Separate Node processes may safely use the same file on a persistent local disk.
 */
export function openStore(file: string, legacyFile?: string) {
  if (file !== ":memory:")
    fs.mkdirSync(path.dirname(file), { recursive: true });
  const sql = new Database(file);
  sql.pragma("journal_mode = WAL");
  sql.pragma("synchronous = FULL");
  sql.pragma("busy_timeout = 5000");
  sql.exec(`
    CREATE TABLE IF NOT EXISTS checkout_quotes (id TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at INTEGER NOT NULL, policy_id TEXT);
    CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS stream_deliveries (
      id TEXT PRIMARY KEY, stream_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
      result TEXT NOT NULL, received_at TEXT NOT NULL,
      chain_id INTEGER NOT NULL, vault TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stream_blocks (
      chain_id INTEGER NOT NULL, vault TEXT NOT NULL, number INTEGER NOT NULL,
      hash TEXT NOT NULL, timestamp INTEGER NOT NULL,
      PRIMARY KEY(chain_id, vault, number)
    );
    CREATE TABLE IF NOT EXISTS stream_orphans (
      chain_id INTEGER NOT NULL, vault TEXT NOT NULL, hash TEXT NOT NULL,
      PRIMARY KEY(chain_id, vault, hash)
    );
    CREATE TABLE IF NOT EXISTS stream_events (
      id TEXT PRIMARY KEY, chain_id INTEGER NOT NULL, vault TEXT NOT NULL,
      policy_id TEXT, block_number INTEGER NOT NULL, block_hash TEXT NOT NULL,
      tx_index INTEGER NOT NULL, log_index INTEGER NOT NULL,
      event TEXT NOT NULL, canonical INTEGER NOT NULL DEFAULT 1, received_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS stream_events_policy ON stream_events(chain_id, vault, policy_id, canonical, block_number, tx_index, log_index);
    CREATE INDEX IF NOT EXISTS stream_events_blocks ON stream_events(chain_id, vault, block_number, block_hash);
  `);
  try {
    sql
      .transaction(() => {
        if (sql.prepare("SELECT 1 FROM app_state WHERE id=1").get()) return;
        let initial = empty();
        if (legacyFile && fs.existsSync(legacyFile)) {
          const parsed = JSON.parse(fs.readFileSync(legacyFile, "utf8"));
          if (
            !Array.isArray(parsed.policies) ||
            !parsed.offers ||
            !Array.isArray(parsed.customEvents)
          ) {
            throw new Error(
              "Legacy database is invalid; refusing to overwrite existing data.",
            );
          }
          initial = parsed;
        }
        sql
          .prepare("INSERT INTO app_state(id,data) VALUES(1,?)")
          .run(JSON.stringify(initial));
      })
      .immediate();
  } catch (error) {
    sql.close();
    throw error;
  }

  const read = () =>
    JSON.parse(
      (
        sql.prepare("SELECT data FROM app_state WHERE id=1").get() as {
          data: string;
        }
      ).data,
    ) as AppData;
  const write = (data: AppData) =>
    sql
      .prepare("UPDATE app_state SET data=? WHERE id=1")
      .run(JSON.stringify(data));
  const mutate = (fn: (data: AppData) => void) =>
    sql
      .transaction(() => {
        const data = read();
        fn(data);
        write(data);
      })
      .immediate();
  const scope = () => ({
    chainId: deployment.chainId,
    vault: (process.env.ARC_VAULT_ADDRESS ?? deployment.address).toLowerCase(),
  });

  function project(policy: Policy): Policy {
    // A simulated transaction is never represented as verified onchain activity.
    const { chain: _ignored, ...base } = policy;
    void _ignored;
    if (base.arc.mode !== "live") return base;
    const { chainId, vault } = scope();
    const policyHash = (base.arc.policyIdHex ?? hash(base.id)).toLowerCase();
    const marketHash = (
      base.arc.marketRefHex ??
      hash(`${base.hedgeLeg.eventTicker}:${base.coverageId}`)
    ).toLowerCase();
    const rows = sql
      .prepare(
        `SELECT event FROM stream_events
      WHERE chain_id=? AND vault=? AND policy_id=? AND canonical=1
      ORDER BY block_number DESC, tx_index DESC, log_index DESC`,
      )
      .all(chainId, vault, policyHash) as { event: string }[];
    const events = rows
      .map((r) => JSON.parse(r.event) as VaultEvent)
      .filter((e) => e.marketRef.toLowerCase() === marketHash);
    const purchase = events.find((e) => e.name === "PolicyPurchased");
    const settlement = events.find((e) => e.name === "PolicySettled");
    if (!purchase && !settlement) {
      return base.confirmationMode === "stream"
        ? {
            ...base,
            status: base.status === "settling" ? "settling" : "pending",
          }
        : base;
    }
    const state = settlement
      ? settlement.args.triggered
        ? "paid"
        : "expired"
      : "active";
    const chain: ChainProof = {
      source: "quicknode",
      state,
      purchase,
      settlement,
    };
    // Historical purchase-only backfills must not downgrade a policy which
    // was already finalized by the receipt path before Streams was enabled.
    const legacyFinal =
      base.confirmationMode !== "stream" &&
      ["paid", "expired"].includes(base.status);
    const status =
      !settlement && (base.status === "settling" || legacyFinal)
        ? base.status
        : state;
    const confirmedArc = purchase
      ? {
          ...base.arc,
          txHash: purchase.transactionHash as `0x${string}`,
          explorerUrl: `https://testnet.arcscan.app/tx/${purchase.transactionHash}`,
        }
      : base.arc;
    if (!settlement)
      return {
        ...base,
        arc: confirmedArc,
        status,
        chain,
        purchaseError: undefined,
      };
    const txHash = settlement.transactionHash as `0x${string}`;
    return {
      ...base,
      arc: confirmedArc,
      status,
      chain,
      settlementError: undefined,
      purchaseError: undefined,
      settledAt: new Date(settlement.blockTimestamp * 1000).toISOString(),
      settlement: {
        triggered: settlement.args.triggered === true,
        hedgeProceeds: base.settlement?.hedgeProceeds ?? 0,
        arc: {
          mode: "live",
          txHash,
          explorerUrl: `https://testnet.arcscan.app/tx/${txHash}`,
          policyIdHex: policyHash as `0x${string}`,
          marketRefHex: marketHash as `0x${string}`,
        },
      },
    };
  }
  function delivery(id: string, fingerprint: string): DeliveryResult | null {
    const row = sql
      .prepare("SELECT fingerprint,result FROM stream_deliveries WHERE id=?")
      .get(id) as { fingerprint: string; result: string } | undefined;
    if (!row) return null;
    if (row.fingerprint !== fingerprint)
      throw new DeliveryConflict(
        "Delivery nonce was reused with a different payload.",
      );
    return { ...JSON.parse(row.result), duplicate: true };
  }
  function ingest(
    batch: VaultBatch,
    id: string,
    fingerprint: string,
  ): DeliveryResult {
    return sql
      .transaction(() => {
        const previous = delivery(id, fingerprint);
        if (previous) return previous;
        const receivedAt = new Date().toISOString();
        let eventsRemoved = 0;
        const markOrphan = (blockHash: string) =>
          sql
            .prepare(
              "INSERT OR IGNORE INTO stream_orphans(chain_id,vault,hash) VALUES(?,?,?)",
            )
            .run(batch.chainId, batch.vault, blockHash);
        const isOrphan = (blockHash: string) =>
          !!sql
            .prepare(
              "SELECT 1 FROM stream_orphans WHERE chain_id=? AND vault=? AND hash=?",
            )
            .get(batch.chainId, batch.vault, blockHash);
        for (const orphan of batch.orphanedBlocks) {
          markOrphan(orphan.hash);
          eventsRemoved += sql
            .prepare(
              "UPDATE stream_events SET canonical=0 WHERE chain_id=? AND vault=? AND block_number=? AND block_hash=? AND canonical=1",
            )
            .run(
              batch.chainId,
              batch.vault,
              orphan.number,
              orphan.hash,
            ).changes;
          sql
            .prepare(
              "DELETE FROM stream_blocks WHERE chain_id=? AND vault=? AND number=? AND hash=?",
            )
            .run(batch.chainId, batch.vault, orphan.number, orphan.hash);
        }
        for (const block of batch.blocks) {
          // A separately signed historical replay cannot resurrect a known
          // orphan and replace the newer canonical block at the same height.
          if (isOrphan(block.hash)) continue;
          const previousBlock = sql
            .prepare(
              "SELECT hash FROM stream_blocks WHERE chain_id=? AND vault=? AND number=?",
            )
            .get(batch.chainId, batch.vault, block.number) as
            { hash: string } | undefined;
          if (previousBlock && previousBlock.hash !== block.hash) {
            markOrphan(previousBlock.hash);
            eventsRemoved += sql
              .prepare(
                "UPDATE stream_events SET canonical=0 WHERE chain_id=? AND vault=? AND block_number=? AND canonical=1",
              )
              .run(batch.chainId, batch.vault, block.number).changes;
          }
          sql
            .prepare(
              `INSERT INTO stream_blocks(chain_id,vault,number,hash,timestamp) VALUES(?,?,?,?,?)
          ON CONFLICT(chain_id,vault,number) DO UPDATE SET hash=excluded.hash,timestamp=excluded.timestamp`,
            )
            .run(
              batch.chainId,
              batch.vault,
              block.number,
              block.hash,
              block.timestamp,
            );
        }
        let eventsInserted = 0;
        for (const event of batch.events) {
          const result = sql
            .prepare(
              `INSERT INTO stream_events(id,chain_id,vault,policy_id,block_number,block_hash,tx_index,log_index,event,received_at)
          VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,
            )
            .run(
              event.id,
              event.chainId,
              event.vault,
              event.policyId ?? null,
              event.blockNumber,
              event.blockHash,
              event.transactionIndex,
              event.logIndex,
              JSON.stringify(event),
              receivedAt,
            );
          eventsInserted += result.changes;
          sql
            .prepare("UPDATE stream_events SET canonical=? WHERE id=?")
            .run(isOrphan(event.blockHash) ? 0 : 1, event.id);
        }
        const result: DeliveryResult = {
          duplicate: false,
          eventsInserted,
          eventsRemoved,
          fromBlock: batch.fromBlock,
          toBlock: batch.toBlock,
        };
        sql
          .prepare(
            "INSERT INTO stream_deliveries(id,stream_id,fingerprint,result,received_at,chain_id,vault) VALUES(?,?,?,?,?,?,?)",
          )
          .run(
            id,
            batch.streamId,
            fingerprint,
            JSON.stringify(result),
            receivedAt,
            batch.chainId,
            batch.vault,
          );
        // Old nonces can be pruned safely: timestamp checks reject old deliveries;
        // event primary keys continue to make freshly signed historical replays idempotent.
        sql
          .prepare("DELETE FROM stream_deliveries WHERE received_at < ?")
          .run(new Date(Date.now() - 30 * 86400_000).toISOString());
        // Empty-block heartbeats need only a bounded reorg window. Event rows
        // retain their own block identities permanently for replay deduplication.
        sql
          .prepare(
            `DELETE FROM stream_blocks WHERE chain_id=? AND vault=? AND number <
        (SELECT COALESCE(MAX(number),0)-10000 FROM stream_blocks WHERE chain_id=? AND vault=?)`,
          )
          .run(batch.chainId, batch.vault, batch.chainId, batch.vault);
        return result;
      })
      .immediate();
  }
  function streamSnapshot(primaryStreamId?: string): StreamSnapshot {
    const { chainId, vault } = scope();
    const row = sql
      .prepare(
        `SELECT COUNT(*) AS deliveries, MAX(received_at) AS lastDeliveryAt FROM stream_deliveries WHERE chain_id=? AND vault=?`,
      )
      .get(chainId, vault) as {
      deliveries: number;
      lastDeliveryAt: string | null;
    };
    if (primaryStreamId)
      row.lastDeliveryAt = (
        sql
          .prepare(
            "SELECT MAX(received_at) AS lastDeliveryAt FROM stream_deliveries WHERE chain_id=? AND vault=? AND stream_id=?",
          )
          .get(chainId, vault, primaryStreamId) as {
          lastDeliveryAt: string | null;
        }
      ).lastDeliveryAt;
    const counts = sql
      .prepare(
        `SELECT SUM(canonical) AS events, SUM(1-canonical) AS orphanedEvents FROM stream_events WHERE chain_id=? AND vault=?`,
      )
      .get(chainId, vault) as {
      events: number | null;
      orphanedEvents: number | null;
    };
    const last = sql
      .prepare(
        "SELECT MAX(number) AS lastBlock FROM stream_blocks WHERE chain_id=? AND vault=?",
      )
      .get(chainId, vault) as { lastBlock: number | null };
    const rows = sql
      .prepare(
        `SELECT event,received_at,canonical FROM stream_events WHERE chain_id=? AND vault=? ORDER BY block_number DESC,tx_index DESC,log_index DESC LIMIT 30`,
      )
      .all(chainId, vault) as {
      event: string;
      received_at: string;
      canonical: number;
    }[];
    return {
      ...row,
      ...last,
      events: counts.events ?? 0,
      orphanedEvents: counts.orphanedEvents ?? 0,
      recent: rows.map(
        (r) =>
          ({
            ...JSON.parse(r.event),
            receivedAt: r.received_at,
            canonical: !!r.canonical,
          }) as StoredActivity,
      ),
    };
  }
  return {
    policies: () =>
      read()
        .policies.map(project)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    policy: (id: string) => {
      const p = read().policies.find((p) => p.id === id);
      return p ? project(p) : undefined;
    },
    saveQuote: (q: CheckoutQuote) => sql.transaction(() => {
      sql.prepare("DELETE FROM checkout_quotes WHERE expires_at < ?").run(Date.now() - 86400_000);
      sql.prepare("INSERT INTO checkout_quotes(id,data,expires_at) VALUES(?,?,?)").run(q.id, JSON.stringify(q), Date.parse(q.expiresAt));
    }).immediate(),
    checkoutQuote: (id: string): CheckoutQuote | undefined => {
      const row = sql.prepare("SELECT data FROM checkout_quotes WHERE id=?").get(id) as { data: string } | undefined;
      return row ? JSON.parse(row.data) : undefined;
    },
    addPolicy: (p: Policy) =>
      mutate((d) => {
        if (p.quoteId) {
          const claim = sql.prepare("UPDATE checkout_quotes SET policy_id=? WHERE id=? AND policy_id IS NULL AND expires_at>?").run(p.id, p.quoteId, Date.now());
          if (!claim.changes) throw new Error("Quote expired or already used. Refresh prices before purchasing.");
        }
        if (d.policies.some((x) => x.id === p.id))
          throw new Error("Duplicate policy id");
        d.policies.push(p);
      }),
    updatePolicies: (fn: (p: Policy) => Policy) =>
      mutate((d) => {
        d.policies = d.policies.map(fn);
      }),
    claimSettlement: (ids: string[]) =>
      sql
        .transaction(() => {
          const d = read();
          const wanted = new Set(ids);
          const eligible = d.policies.filter(
            (p) =>
              wanted.has(p.id) &&
              project(p).status === "active" &&
              p.status !== "settling",
          );
          if (eligible.length !== ids.length) return false;
          d.policies = d.policies.map((p) =>
            wanted.has(p.id)
              ? {
                  ...p,
                  status: "settling" as const,
                  settlementError: undefined,
                }
              : p,
          );
          write(d);
          return true;
        })
        .immediate(),
    offer: (id: string) => read().offers[id],
    offers: () => read().offers,
    setOffer: (o: OfferConfig, expectedUpdatedAt?: string) => {
      let saved = o;
      mutate((d) => {
        const previous = d.offers[o.eventId];
        if (expectedUpdatedAt !== undefined && (previous?.updatedAt ?? UNSAVED_OFFER_VERSION) !== expectedUpdatedAt)
          throw new Error("Protection changed elsewhere. Refresh before saving.");
        const timestamp = Math.max(Date.parse(o.updatedAt), previous ? Date.parse(previous.updatedAt) + 1 : 0);
        saved = { ...o, updatedAt: new Date(timestamp).toISOString() };
        d.offers[o.eventId] = saved;
      });
      return saved;
    },
    customEvents: () => read().customEvents,
    addCustomEvent: (e: TicketEvent) =>
      mutate((d) => {
        d.customEvents = [e, ...d.customEvents.filter((x) => x.id !== e.id)];
      }),
    // Reset orders for the demo without deleting the independent chain journal.
    reset: () =>
      mutate((d) => {
        Object.assign(d, empty());
      }),
    delivery,
    ingest,
    streamSnapshot,
    close: () => sql.close(),
  };
}
export type Store = ReturnType<typeof openStore>;
const globals = globalThis as typeof globalThis & {
  __bluffStores?: Map<string, Store>;
};
function currentStore(): Store {
  const file =
    process.env.BLUFF_DB_PATH ??
    path.join(process.cwd(), "data", "runtime", "bluff.sqlite");
  const stores = (globals.__bluffStores ??= new Map<string, Store>());
  if (!stores.has(file))
    stores.set(
      file,
      openStore(
        file,
        process.env.BLUFF_LEGACY_DB_PATH ??
          path.join(process.cwd(), "data", "runtime", "db.json"),
      ),
    );
  return stores.get(file)!;
}
export const db = {
  policies: () => currentStore().policies(),
  policy: (id: string) => currentStore().policy(id),
  addPolicy: (p: Policy) => currentStore().addPolicy(p),
  saveQuote: (q: CheckoutQuote) => currentStore().saveQuote(q),
  checkoutQuote: (id: string) => currentStore().checkoutQuote(id),
  updatePolicies: (fn: (p: Policy) => Policy) =>
    currentStore().updatePolicies(fn),
  claimSettlement: (ids: string[]) => currentStore().claimSettlement(ids),
  offer: (id: string) => currentStore().offer(id),
  offers: () => currentStore().offers(),
  setOffer: (o: OfferConfig, expectedUpdatedAt?: string) => currentStore().setOffer(o, expectedUpdatedAt),
  customEvents: () => currentStore().customEvents(),
  addCustomEvent: (e: TicketEvent) => currentStore().addCustomEvent(e),
  reset: () => currentStore().reset(),
  delivery: (id: string, fingerprint: string) =>
    currentStore().delivery(id, fingerprint),
  ingest: (batch: VaultBatch, id: string, fingerprint: string) =>
    currentStore().ingest(batch, id, fingerprint),
  streamSnapshot: (primaryStreamId?: string) =>
    currentStore().streamSnapshot(primaryStreamId),
};
