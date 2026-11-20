# Ticketmaster interface reference and implementation

Research date: November 20, 2026. Target: US Ticketmaster web, with Bluff protection added to the existing local ticketing flow.

## Evidence and limits

Ticketmaster's public server-rendered homepage, Knicks artist page, event page, venue page, theme JSON, font files and image assets were accessible. Interactive navigation in the automated browser returned Ticketmaster's challenge/403 page. The public homepage HTML was rendered locally with scripts removed to inspect its actual CSS and responsive layout. Its personalized highlight area remains a loading skeleton without the client requests; that area cannot be verified as a pixel-identical copy of a personalized live session.

The current seat-picker reference is Ticketmaster's own August 2026 article. The checkout reference is the screenshot explicitly labeled the current checkout in a January 2026 UX analysis, rather than that author's proposed redesign. The account is authenticated and was not accessible; the local account screen extends the shared commerce design, rather than claiming a verified pixel-identical authenticated account.

No login, security challenge bypass, real ticket reservation or real Ticketmaster purchase was performed.

## Primary sources

- [US homepage](https://www.ticketmaster.com/): public HTML, embedded theme and category content.
- [Knicks artist and schedule](https://www.ticketmaster.com/new-york-knicks-tickets/artist/805988).
- [Exact Knicks–Portland event](https://www.ticketmaster.com/new-york-knicks-vs-portland-trail-new-york-new-york-11-21-2026/event/3B006511E9208636).
- [Madison Square Garden venue page](https://www.ticketmaster.com/venue/483329): source of the exact event map URL.
- [Exact event's native seating chart](https://mapsapi.tmol.io/maps/geometry/3/event/3B006511E9208636/staticImage?type=png&systemId=HOST).
- [Official interactive map guide](https://blog.ticketmaster.com/interactive-seating-chart/): header, map/list split, price filters, Lowest Price / Best Seats tabs, selection colors, checkout path.
- [Interactive map help](https://help.ticketmaster.com/hc/en-us/articles/9786899270545-What-is-the-interactive-seat-map-and-how-do-I-use-it).
- [All-in pricing](https://help.ticketmaster.com/hc/en-us/articles/9663528775313-How-are-ticket-prices-and-fees-determined): required fees included in displayed prices; optional additions may change checkout totals.
- [Mobile delivery](https://help.ticketmaster.com/hc/en-us/articles/9641645631889-What-ticket-delivery-options-does-Ticketmaster-offer).
- [Insurance placement](https://www.ticketmaster.com/insurance): opt-in during checkout. Bluff is separate from Allianz's existing non-attendance insurance.
- [Original commerce designer's case study](https://www.imemilysmith.com/one-page-checkout): historical evidence for the one-page accordion structure, not a current screenshot reference.

Secondary visual evidence: [2026 current-checkout screenshot and analysis](https://medium.com/@sanbansal110/ticketmasters-shopping-cart-experience-12326c46fc32). The original screenshot is retained in `ticketmaster-reference/checkout-2026-reference.png`.

## Directly measured design specifications

From the public homepage's actual rendered HTML at 1280 CSS pixels:

| Element | Measurement |
| --- | --- |
| Utility strip | 44 px high; black |
| Main navigation | 80 px high; blue |
| Search form | x=140, y=132, width=1000, height=62 px |
| Full header | 214 px high |
| Main navigation text | Averta 600, 18 px |
| Input text | Averta 400, 16 px |
| Input labels | 12 px, uppercase |
| Section heading | Averta 700, 24/28 px, uppercase, short rule above |

At 390 CSS pixels:

- Country strip ~42 px; compact navigation 44 px.
- Search spans 358 px with 16 px side margins.
- Location and dates occupy the first row; query spans the second row.
- Full header ~223 px, with a white search background.

The theme's actual values:

| Token | Value |
| --- | --- |
| Primary blue | `#024ddf` |
| Blue hover | `#0139a7` |
| Black | `#121212` |
| Secondary text | `#646464` |
| Main border | `#bfbfbf` |
| Light border | `#ebebeb` |
| Alternate surface | `#f6f6f6` |
| Transaction green | `#048851` |
| Available seats | `#2a55d9` |
| Resale pink | `#d0006f` |

Actual Averta 400/600/700 WOFF2 files, the theme wordmark geometry, category photography, editorial imagery and exact Knicks seating chart are served locally. Original URLs are recorded in [the asset manifest](../web/public/ticketmaster/SOURCES.json).

## Implemented pages and additions

- `/seatwise`: actual shared header/navigation/search, highlight grid, popular categories, guides, featured sidebar and dark footer. Highlights use local hedgeable events; they are a documented content adaptation, not a claim about the live personalized campaign.
- `/seatwise?category=sports`: functional event filters and results, date blocks, event imagery, all-in ticket prices and native-style calls to action.
- `/seatwise/event/[id]`: black event header and thumbnail, breadcrumbs, More Info dialog, important-information strip, large map left, ticket/filter list right, independent scrolling and selection summary. The Knicks map is the original event-specific source image, with local selection overlays. Other venues retain a representative interactive diagram. Inventory and prices remain the app's demo inventory, not Ticketmaster inventory.
- `/seatwise/checkout/[id]`: separate black checkout shell, title underline, timer, white delivery/payment panels, right-side total and ticket details, green Place Order, required terms agreement. Bluff occupies the insurance add-on position and visual structure, with explicit opt-in, exact premiums/payouts, team choice and an optional decline. The live source's ticket-specific extras/advertisements are not invented for unrelated inventory.
- `/seatwise/account`: shared shell, My Events tabs and order details with Bluff active/paid/expired status. This is an adapted account view, with the verification limit noted above.
- All added interface icons use original [Untitled UI free SVGs](https://www.untitledui.com/free-icons), obtained from its [official repository](https://github.com/untitleduico/icons). Original geometry is preserved and uniformly scaled; license retained beside the assets.

## Performance investigation

The initial implementation still gated cold route rendering on the full Gemini scan. Browser first byte measured 4293 ms; first quote calls in Next development logs measured 2560 ms. Module-level cache state reset during hot reloads or separately compiled routes.

The revised loader bootstraps from the local snapshot, shares state through a process-wide cache keyed by upstream/offline mode, deduplicates scans, and refreshes the live universe in the background. No render or quote waits for the scan. Successful live data replaces the snapshot; transient failures retain the last usable catalog and back off. Scans use four concurrent pages and a four-second whole-scan deadline. Initial checkout quotes are included in server HTML, avoiding an extra initial client request.

Observed development response after this change: event first byte 151 ms; quote response 226 ms including compilation. Regression coverage deliberately stalls Gemini and checks that cold callers still resolve, concurrent readers share work, route module reloads share the cache, and failed refreshes preserve live data.

The process-wide background refresh is intended for the current long-running local Node server. A future serverless deployment should use a scheduled/persistent refresh rather than assuming work continues after a request ends.

## Verification results

- Web tests: 7 passed. The new regression fails against the original implementation with `cold render blocked on Gemini`, then passes with the snapshot-first loader.
- ESLint and TypeScript: passed.
- Optimized Next.js production build: passed.
- Browser: mobile protected purchase created an active policy; explicit coverage/decline selection and terms acceptance are enforced; total includes the selected premium; account shows active and paid policies. Trades and chain receipts used the app's configured simulated mode.
- Viewports checked: 390×844 and 1470×840. No horizontal overflow or broken images on the checked pages. Fresh, fully hydrated browser checks reported no console errors.
- Separate production process, first request after startup: event HTTP 200, first byte 131 ms. Subsequent event first byte 15 ms; checkout 22 ms; storefront 14 ms; account 8 ms. Browser checkout fully loaded in 114 ms. These are local measurements, not network deployment benchmarks.
- Native event map reduced the checked Knicks event HTML from ~174 KB to ~22 KB while preserving a source-accurate venue chart.

To validate an optimized build without overwriting development output:

```sh
cd web
NEXT_BUILD_DIR=.next-check npm run build
NEXT_BUILD_DIR=.next-check npm start -- -p 3010
```

Final preview: optimized build is running on localhost:3000. Fresh process event response measured 64 ms total, checkout 8 ms total. A subsequent browser navigation to the exact Knicks event fully loaded in 40 ms with no console errors. Source changes require rebuilding/restarting this optimized preview.
