# Business demo

Run `npm run dev:business` at [localhost:3003](http://localhost:3003) and `npm run dev:customer` in a second terminal at [localhost:3002](http://localhost:3002). Business uses the dark dashboard; customers get a separate blue/light event browser and checkout. Both processes share the same order and offer store.

1. Choose **Add event** and select a market-backed event, such as Portland at New York.
2. Choose protection options and refund percentages, then **Publish protection**.
3. In the customer interface, browse to the event, choose tickets and protection, and complete the purchase. Ticket prices are examples; protection pricing uses the saved refund configuration and the existing pricing engine.
4. Return to the business interface and open **Contracts**. The customer’s contract is persisted in the ledger. Its Gemini order and Arc evidence are under **Hedge & transaction evidence**.
5. Select **Resolve demo outcome** and choose whether the protected outcome happened. This resolves active simulated contracts with the selected protection for that event. The paid-out or completed status appears in the contract ledger and dashboard immediately.

The dashboard has three totals: currently active customer contracts, distinct events with active contracts, and all-time confirmed premiums before hedge costs. Pending purchases are excluded from premiums. A payout reduces the active count; it does not erase the premium from the sales total.

The simplified demo is simulated by default, even when Gemini API keys are configured. No tickets are issued, no charge is processed, no real hedge is placed, and no onchain payment is sent. The one exception is the explicit `GEMINI_LIVE_HEDGE=1` switch: with it and both keys set, checkout sends a real fill-or-kill Gemini order for Gemini-priced covers, while Kalshi-priced covers and the Arc record stay simulated. Demo controls exclude live policies. Repeated requests from one checkout use the same contract ID, so retries do not inflate the ledger.

The primary navigation is **Dashboard · Events · Contracts**. Customer browsing and checkout live in their own interface at `/tickets`, with no business navigation or resolution controls. Original `/seatwise/*` routes are retained for compatibility with the earlier implementation; they are not linked in the business demo. `/demo` redirects to customer event selection, and `/console/policies` redirects to the new Contracts ledger.

QuickNode remains a real independent Arc listener under **Integrations → Arc & QuickNode activity**. A simulated demo contract never claims QuickNode confirmation or links a mock transaction to ArcScan. To demonstrate real onchain activity, use genuine matching purchase/settlement evidence from the real execution path separately.

## Verification

From `web/`:

```bash
npm test
npm run lint
NEXT_BUILD_DIR=.next-streams npm run build
npm run test:demo:http
npm run test:streams:http
```

The demo HTTP test uses a temporary database and a separate production server. It covers unpublished checkouts, protection configuration validation, purchases, concurrent retries, dashboard totals, both settlement outcomes, restart persistence and isolation from live contracts. It deliberately configures unusable execution credentials and a local fake trading URL to prove the demo never attempts a real trade.

Interface rules are in [DESIGN.md](../DESIGN.md): no eyebrows or explanatory subcaptions; business uses dark neutral surfaces, while customer screens use white cards and Ticketmaster-style blue.

## Pricing quotes

Checkout requests `/api/quotes` on entry and after ticket tier or quantity changes. The server fetches the relevant Gemini event books with a four-second timeout, checks the published protection settings, and calculates premiums. Catalog page rendering still uses the fast background cache. There is no artificial loading delay.

A server quote lasts 30 seconds. The customer sees a colored countdown chip at the top right. At zero, checkout automatically fetches one new quote and disables protected purchase until it arrives. Failed requests show a retry action without looping. Purchases use the stored premium, refund and hedge inputs; they cannot silently recalculate a different price. Quotes bind the event, tier, quantity, team and offer version. SQLite atomically consumes a quote with its policy, so another order cannot reuse it. Retries of an already created order remain idempotent.

Fresh executable ask data is labeled **Gemini prices**. Offline data, failed requests and indicative prices are labeled **Demo estimate**. The business builder shows **Estimated premium** because it configures refund terms, not a fixed selling price. Star Sits pricing continues to include a modeled probability and proxy hedge.

These time-bound quotes apply to the simulated checkout. They do not reserve a Gemini order or guarantee a live fill. The legacy live purchase route remains separate; a production price guarantee needs an execution/reserve policy before enabling a hold there.
