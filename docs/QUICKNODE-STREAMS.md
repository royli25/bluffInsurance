# QuickNode Streams: Arc purchase and payout confirmations

QuickNode fills the blockchain ingestion layer. Gemini supplies market data and hedge execution, Arc executes escrow and settlement, and Streams reports what the vault actually emitted. With Streams enabled, live policies become active only after `PolicyPurchased`; payouts become paid or expired only after `PolicySettled`. The webhook never selects a market outcome, places a hedge, or sends funds.

```mermaid
flowchart LR
  UI[Checkout / settlement operator] --> API[Next.js API]
  API --> Gemini[Gemini hedge execution]
  API --> Arc[Arc vault transaction]
  Arc --> Streams[QuickNode Streams]
  Streams -->|signed POST| Hook[/api/webhooks/quicknode]
  Hook --> Journal[(SQLite event journal)]
  Journal --> Status[Policy and payout status]
  Status --> Account[Fan account / console activity]
```

The standalone `/demo/checkout` is a presentation demo. The integrated purchase flow is `/seatwise/checkout/[eventId]`, with confirmations at `/seatwise/account` and `/console/activity`.

## Run continuously

Use Node 22 or newer and a **persistent local disk**. SQLite WAL supports multiple processes sharing that disk; independent replicas with separate disks and ephemeral serverless filesystems are not supported. For a horizontally scaled deployment, move this journal and the order store to a shared transactional database first.

```bash
cd web
npm install
npm run streams:init
npm run streams:plan
npm run build
npm start
```

`streams:init` preserves existing environment values, generates a random 32-byte token in ignored `.env.local`, sets file permissions to `0600`, and leaves Streams disabled. It does not create a paid provider resource. The app uses `data/runtime/bluff.sqlite`; set `BLUFF_DB_PATH` to an absolute path on your persistent volume for deployment. Run the process under your usual supervisor and terminate it gracefully before maintenance.

On first access, the existing JSON order database is imported in one transaction. The original `data/runtime/db.json` is retained unchanged; later writes use SQLite. Invalid legacy JSON fails migration instead of replacing orders with an empty database. Back up SQLite with its online backup facility, or stop all writers before copying the database and any WAL files. Resetting demo orders retains the independent chain journal.

## Current local setup (November 20, 2026)

The existing QuickNode account is using its $0, no-card, 30-day trial with 10M credits and no overage. The active Stream is `79e529e4-6fcc-4d82-ac51-b3f1ad016c08`, named **Bluff Arc policy confirmations**. Its generated signing token and destination are stored in ignored `.env.local`; no management API key was needed because configuration was completed through the dashboard.

Actual trial limits differ from the paid-plan CLI defaults below: **one block per delivery**, **10 retries**, a 10-second retry interval and a 15-second timeout. Reorg restreaming is unavailable on this trial. The receiver still supports reorg corrections if the provider plan later enables them. The exact provider network identifier `arc-testnet` was verified in the real filter test output.

The public tunnel terminates at a loopback relay that only allows `GET` and authenticated `POST` requests for `/api/webhooks/quicknode`. Other paths, including `/api/policies`, return `404`. The receiver performs the full HMAC verification; the relay forwards exact signed bytes and only the needed headers. The provider's unsigned **Check Connection** probe returns `401` by design; real signed Stream deliveries succeed. Do not disable signature checking to make that unsigned probe pass.

Keep these three processes running for the local demo:

```bash
# Terminal 1, web/: existing optimized build
NEXT_BUILD_DIR=.next-streams npm start

# Terminal 2, web/: route-limited relay, bound only to 127.0.0.1:3102
node scripts/quicknode/relay.mjs

# Terminal 3: Cloudflare's official prebuilt binary, checksum verified at setup
~/.local/share/bluff-quicknode/cloudflared tunnel --url http://127.0.0.1:3102 --no-autoupdate
```

The quick tunnel URL changes if that process restarts. Update the existing Stream's destination in QuickNode and `QUICKNODE_WEBHOOK_URL` locally, then reactivate it if the retry limit paused it. For a stable hosted demo, use a persistent deployment or named tunnel. Do not point the tunnel directly at port 3000. The active destination and last verification are recorded without credentials in ignored `web/data/runtime/quicknode-setup.json`.

The existing Arc client currently remains in simulated mode because no operator key is configured locally. Receiving real blocks does not turn a simulated purchase into an onchain policy. Public RPC inspection found two older purchases and their settlements in blocks `73124960`–`73125059`; these were inspected read-only and were not imported as QuickNode evidence.

## Connect your QuickNode account

1. Give the running application a public HTTPS endpoint ending in `/api/webhooks/quicknode`. A tunnel is sufficient for a hackathon; it must remain running and its URL must stay stable. Set `QUICKNODE_WEBHOOK_URL` to that full URL.
2. Put a QuickNode API key with Streams permissions in `.env.local` as `QUICKNODE_API_KEY`. Do not use an RPC endpoint token or an Arc private key here. The management key is only used by the CLI and can be omitted from the application server's environment afterward.
3. Run `npm run streams:plan` to inspect the non-secret configuration. The target is Arc testnet, chain `5042002`, vault `0xfab42bf0ea82413d078af58712ef31a43b7ccec8` (or `ARC_VAULT_ADDRESS`). `QUICKNODE_STREAM_NETWORK` defaults to `arc-testnet`; if your dashboard/API shows another identifier for Arc testnet, set it to that exact value. Do not select Arc mainnet.
4. Run `npm run streams:create`. This creates a **paused** continuous Stream with `block_with_receipts`, 20-block batches, elastic delivery, reorg restreaming, and the generated vault filter. Its fixed `external_id` prevents duplicate creation on retry. To include earlier purchases, use `npm run streams:create -- --from START_BLOCK`, choosing a recent known transaction block rather than genesis.
5. Save the returned ID as `QUICKNODE_STREAM_ID`, set `QUICKNODE_STREAMS_ENABLED=1`, and restart the app. Confirm that `GET /api/webhooks/quicknode` returns `configured: true`, then run `npm run streams:activate`.
6. Open `/console/activity`. Empty blocks are intentionally delivered as heartbeats, so the status should change from “Waiting for first delivery” to “Receiving Arc events” even before a purchase. It becomes “Delivery overdue” after two minutes without a primary-Stream delivery. `npm run streams:status` checks provider state; `npm run streams:pause` pauses it.

`npm run streams:filter` prints the exact JavaScript filter if you prefer dashboard setup. Use the generated security token as the webhook destination's security token, not as a custom bearer header. The filter keeps only successful vault receipt logs for `PolicyPurchased`, `PolicySettled`, `MarketSettled`, and `HedgeProceedsDeposited`, plus each block's identity. Raw unfiltered provider payloads are deliberately rejected.

Creating a Stream starts a provider resource that can consume credits when activated. QuickNode bills for blocks processed, including blocks excluded by filtering. Historical range selection therefore matters. The supplied settings pause after 30 unsuccessful deliveries, retrying every 10 seconds; check and reactivate a paused Stream after an extended outage. Restream-on-reorg availability depends on the account plan.

## Confirmation and recovery behavior

- **Live purchase:** persist customer/order context before submitting to Arc. Return the submitted hash without waiting for the final receipt when Streams is enabled. The order remains pending until its matching vault event arrives.
- **Live settlement:** atomically claim active policies before submitting, then hold them as settling until the events confirm payment or expiry. Another request cannot claim them concurrently. Required approvals and hedge-proceeds deposits still wait for successful receipts.
- **RPC uncertainty:** retain the pending or settling record with a reconciliation message. A timeout does not prove failure. Do not resubmit a trade or payout blindly. Inspect the stored transaction hash and vault policy state, then recover missing events using a backfill. If no policy transaction was ever sent, operator recovery is required; automatic rebroadcast is intentionally not implemented.
- **Simulation:** without `ARC_OPERATOR_KEY`, purchases and settlements remain explicitly simulated. They never acquire a QuickNode confirmation, even if a similarly named policy event is received.
- **Outcomes:** the existing settlement operator/demo control supplies `triggered`. Streams confirms execution, not whether a team won. Automated Gemini resolution polling is a separate concern.
- **Amounts:** event evidence retains exact onchain integers and displays USDC at six decimals. The existing testnet `ARC_AMOUNT_SCALE` defaults to `0.01`: a UI coverage amount of $51.90 corresponds to **0.519 USDC on testnet**. The current vault client defaults the holder to the operator wallet; consumer embedded wallets and card refunds are not implemented by this integration.

The receiver verifies HMAC-SHA256 over `nonce + timestamp + exact uncompressed JSON`, checks a five-minute clock window for new deliveries, and uses a constant-time signature comparison. It bounds compressed and uncompressed input to 1 MiB, validates Stream/network/chain/vault scope, and decodes event topics/data against the contract ABI locally. Keep the server clock synchronized. HTTPS/proxies must preserve the body bytes and `X-QN-*` headers. Gzip is supported, though the generated Stream defaults to uncompressed payloads.

The acknowledgement and event journal commit in one SQLite transaction. A committed retry can be acknowledged after the freshness window, but cannot execute work twice; reusing a nonce with different content returns `409`. Database failure returns `503`, allowing provider retries. Event identity includes chain, vault, block hash, transaction hash and log index. Reorg corrections remove orphaned evidence from policy status, retain it in the audit feed, and prevent later historical replays from resurrecting it. Empty-block identities are bounded to the latest 10,000 blocks; event evidence and orphan markers are retained. Delivery nonce records expire after 30 days. Historical events are deduplicated independently of those nonce records.

## Backfill without disturbing the live cursor

```bash
npm run streams:backfill -- --from START_BLOCK --to END_BLOCK
```

This creates a separate **paused, finite** Stream using the same vault filter and destination token. Add the returned ID to comma-separated `QUICKNODE_BACKFILL_STREAM_IDS`, restart the app, then activate that finite Stream in the dashboard. Only the primary Stream updates the live connection heartbeat. Existing purchase and settlement events are deduplicated, and an older purchase cannot overwrite a later settlement. The live Stream's cursor is unchanged.

## Verify the integration

```bash
cd web
npm test
npm run lint
NEXT_BUILD_DIR=.next-streams npm run build
npm run test:streams:http
```

The unit tests cover signature tampering, freshness, gzip, malformed/oversized payloads, Stream scope, replay conflicts, duplicate events, atomic database failure, concurrent settlement claims, historical recovery, legacy migration, reorg removal, stale orphan replays, and the actual generated filter. The HTTP smoke test starts an isolated production server with a temporary SQLite database, delivers signed synthetic purchase/settlement events, checks API and rendered account/activity pages, restarts the entire Node process, and checks persistence and retry deduplication. It neither trades nor modifies the regular app database.

These tests are **synthetic integration evidence**, not proof of a live QuickNode connection. For the hackathon demonstration, connect the account, execute a real Arc testnet purchase and settlement, and show the corresponding provider deliveries, `/console/activity` entries and ArcScan transactions. The subsequent browser setup connected the real Arc testnet Stream on November 20, 2026. QuickNode showed an active Stream, 168 blocks sent and zero delivery errors at verification; the application independently reported authenticated live deliveries. No new purchase or payout transaction was submitted during setup, and historical policy events have not been backfilled through Streams yet.

## Provider references

- [Arc products and testnet](https://www.quicknode.com/docs/arc/api-overview)
- [Supported Stream chains and datasets](https://www.quicknode.com/docs/streams/supported-chains)
- [Payload metadata](https://www.quicknode.com/docs/streams/data-sources)
- [Filter sandbox](https://www.quicknode.com/docs/streams/filters)
- [Create Stream API](https://www.quicknode.com/docs/streams/rest-api/create-stream)
- [Webhook acknowledgement and retries](https://www.quicknode.com/docs/streams/destinations/webhooks)
- [Signature validation](https://www.quicknode.com/guides/quicknode-products/streams/validating-incoming-streams-webhook-messages)
- [Reorg handling](https://www.quicknode.com/docs/streams/reorg-handling)
- [Backfilling](https://www.quicknode.com/docs/streams/backfilling)
