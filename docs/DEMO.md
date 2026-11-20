# Business demo

Start at [localhost:3000](http://localhost:3000), which opens the business dashboard.

1. Choose **Add event** and select a market-backed event, such as Portland at New York.
2. Choose protection options and refund percentages, then **Publish protection**.
3. Select **Open demo checkout**, choose tickets and protection, and complete the purchase. Ticket prices are examples; protection pricing uses the saved refund configuration and the existing pricing engine.
4. Select **View contract & resolve outcome**. The contract is persisted in the ledger. Its Gemini order and Arc evidence are under **Hedge & transaction evidence**.
5. Select **Resolve demo outcome** and choose whether the protected outcome happened. This resolves active simulated contracts with the selected protection for that event. The paid-out or completed status appears in the contract ledger and dashboard immediately.

The dashboard has three totals: currently active customer contracts, distinct events with active contracts, and all-time confirmed premiums before hedge costs. Pending purchases are excluded from premiums. A payout reduces the active count; it does not erase the premium from the sales total.

The simplified demo is always simulated, even when live execution credentials are configured. No tickets are issued, no charge is processed, no real hedge is placed, and no onchain payment is sent. Demo controls exclude live policies. Repeated requests from one checkout use the same contract ID, so retries do not inflate the ledger.

The primary navigation is **Dashboard · Events · Contracts**. The storefront browsing layer has been removed from this flow. Original `/seatwise/*` routes are retained for compatibility with the earlier implementation; they are not linked in the business demo. `/demo` opens event selection, and `/console/policies` redirects to the new Contracts ledger.

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

Interface rules are in [DESIGN.md](../DESIGN.md): no eyebrows, no explanatory subcaptions, neutral surfaces and a restrained type scale.
