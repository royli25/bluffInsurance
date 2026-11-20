# Coverage market routing

Checkout rescans the configured providers whenever its 30-second quote expires. The business dashboard and event configuration refresh their market comparison every 30 seconds while open. Business navigation groups each event, its protection options, and each available provider. Coverage and provider switches persist in the existing offer configuration; quote routing excludes disabled providers. Dashboard switches save immediately; the detailed builder keeps its existing Save/Publish flow.

## Supported comparisons

- NBA Heartbreak Cover: Gemini opponent-winner YES and the matching Kalshi `KXNBAGAME` opponent-winner YES contract. Match league, original New York calendar date, both teams, opponent ticker, market type, active trading status, and rule text. Do not fuzzy-match events by title alone.
- Other protections retain Gemini pricing. Star Sits uses the existing modeled DNP probability and proxy hedge; it is not presented as a directly matched Kalshi DNP contract.
- The comparison is for the covered completed-game winner. Exchange cancellation, postponement, forfeit, dispute, and extraordinary-settlement terms can differ; these books are not represented as identical instruments in all states. Kalshi rule text is retained in quote evidence. Broader contract equivalence and reserve handling for those cases are required before production underwriting across venues.

## Price selection

Read Gemini's public depth20 WebSocket snapshot and Kalshi's public fixed-point order book concurrently with current market metadata. Read Kalshi's current series fee schedule and effective event-level fee overrides. Convert Kalshi NO bids to executable YES asks using `1 - bid`. Walk the full required size through ascending ask levels. Reject insufficient depth, stale snapshots, closed markets, paused exchange trading, and unrecognized fee schedules. New quotes choose the lowest final customer premium among enabled live candidates; ties consistently prefer Gemini. Indicative estimates never beat a live candidate.

Fees are included before Bluff's existing margin and flat fee. Gemini uses its published 0.07 taker formula (override via `GEMINI_TAKER_FEE_RATE` if applicable), rounded up to a cent. Kalshi uses the series multiplier and effective event override with its centicent position-plus-fee rounding. There is no configured FCM surcharge. Quotes are estimates of execution cost, not reserved liquidity or guaranteed fills.

The selected provider, ticker, depth, fees, observed time, alternative quotes, and price persist with the policy. Arc's market reference identifies the underlying event/coverage and stays independent of the hedge venue, allowing policies selected from different providers to share the same coverage settlement group. Changing provider settings invalidates outstanding quotes. Offer writes support an atomic expected-version check to avoid overwriting another business screen's changes.

## Execution boundary

Market data and provider selection are live and need no API key. The connected checkout's existing execution mode remains simulated. It records the chosen venue faithfully and never submits a Kalshi ticker to Gemini. Live execution of routed quotes is explicitly rejected until venue execution, account funding, final fills, and underwriting rules are connected. No Kalshi trading credentials are configured or used by this integration.

`GEMINI_OFFLINE=1` disables Gemini market fetches and WebSocket reads. `KALSHI_OFFLINE=1` independently disables Kalshi. `KALSHI_API_BASE` and `GEMINI_WS_URL` support isolated test servers. Public requests have bounded deadlines; a failed provider does not block a healthy provider from winning.

## Sources and verification

- [Gemini public depth and YES-space convention](https://developer.gemini.com/prediction-markets/websocket/streams)
- [Gemini fee schedule](https://www.gemini.com/fees/predictions)
- [Kalshi order books](https://docs.kalshi.com/api-reference/market/get-market-orderbook)
- [Kalshi API specification](https://docs.kalshi.com/openapi.yaml), including series and event-level fee overrides
- [Kalshi fee schedule](https://kalshi.com/fee-schedule)

`npm test` checks winner changes, disabled providers, stale estimates, slippage, insufficient depth, symbol/date/team matching, and Gemini snapshot parsing. `npm run test:demo:http` additionally checks provider setting validation, quote invalidation, atomic configuration conflicts, Kalshi-selected purchases and payout persistence, fallback after a provider is disabled, and that configured execution credentials never cause an external trade in the checkout flow.
