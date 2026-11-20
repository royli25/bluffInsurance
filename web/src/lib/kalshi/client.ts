import "server-only";
import type { TicketEvent } from "../catalog";
import type { ProviderBook } from "../markets/types";
import { parseLevels } from "../markets/pricing";
const BASE = process.env.KALSHI_API_BASE ?? "https://external-api.kalshi.com/trade-api/v2";
export function kalshiMatch(ev: TicketEvent, rooting: "home" | "away") {
  if (ev.kind !== "sports" || ev.league !== "NBA" || !ev.home || !ev.away) return null;
  const date = new Date(ev.startTime);
  if (!Number.isFinite(+date)) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "2-digit", month: "short", day: "2-digit" }).formatToParts(date);
  const part = (name: string) => parts.find((p) => p.type === name)!.value.toUpperCase();
  const event = `KXNBAGAME-${part("year")}${part("month")}${part("day")}${ev.away.abbr}${ev.home.abbr}`;
  const opponent = rooting === "home" ? ev.away : ev.home;
  return { event, symbol: `${event}-${opponent.abbr}`, opponent, dateLabel: new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "short", day: "numeric" }).format(date) };
}
async function get(route: string, signal: AbortSignal) {
  const r = await fetch(BASE + route, { cache: "no-store", signal });
  if (!r.ok) throw new Error(`Kalshi ${r.status}`);
  return r.json();
}
export async function getKalshiBook(ev: TicketEvent, rooting: "home" | "away"): Promise<ProviderBook | null> {
  const match = kalshiMatch(ev, rooting);
  if (!match || process.env.KALSHI_OFFLINE === "1") return null;
  const signal = AbortSignal.timeout(4000);
  try {
    const [eventData, series, feeChanges, exchange] = await Promise.all([
      get(`/events/${encodeURIComponent(match.event)}`, signal), get("/series/KXNBAGAME", signal),
      get(`/events/fee_changes?event_ticker=${encodeURIComponent(match.event)}&limit=100`, signal),
      get("/exchange/status", signal),
    ]);
    if (exchange.exchange_active !== true || exchange.trading_active !== true) return null;
    if (eventData.event?.event_ticker !== match.event || eventData.event?.series_ticker !== "KXNBAGAME" || eventData.event?.product_metadata?.competition_scope !== "Game") return null;
    const market = (eventData.markets ?? eventData.event?.markets ?? []).find((m: { ticker?: string }) => m.ticker === match.symbol);
    if (!market || market.status !== "active" || market.market_type !== "binary" || (typeof market.yes_sub_title !== "string" || !(match.opponent.name === market.yes_sub_title || match.opponent.name.startsWith(market.yes_sub_title + " "))) || Number(market.notional_value_dollars) !== 1 || market.result || !Number.isFinite(Date.parse(market.close_time)) || Date.parse(market.close_time) <= Date.now()) return null;
    if (market.event_ticker !== match.event || !String(market.rules_primary).startsWith(`If ${market.yes_sub_title} wins the `) || !String(market.rules_primary).includes(`originally scheduled for ${match.dateLabel},`)) return null;
    if (feeChanges.cursor || !Array.isArray(feeChanges.event_fee_changes)) return null;
    const override = feeChanges.event_fee_changes
      .filter((change: { event_ticker: string; scheduled_ts: string }) => change.event_ticker === match.event && Date.parse(change.scheduled_ts) <= Date.now())
      .sort((a: { scheduled_ts: string }, b: { scheduled_ts: string }) => Date.parse(b.scheduled_ts) - Date.parse(a.scheduled_ts))[0];
    const feeType = override?.fee_type_override ?? series.series?.fee_type;
    const multiplier = Number(override?.fee_multiplier_override ?? series.series?.fee_multiplier);
    if (!["quadratic", "quadratic_with_maker_fees"].includes(feeType) || !Number.isFinite(multiplier) || multiplier < 0 || multiplier > 10) return null;
    const book = await get(`/markets/${encodeURIComponent(match.symbol)}/orderbook`, signal);
    return { provider: "kalshi", symbol: match.symbol, asks: parseLevels(book.orderbook_fp?.no_dollars, true),
      observedAt: new Date().toISOString(), feeRate: 0.07 * multiplier,
      rules: `${market.rules_primary}\n${market.rules_secondary}` };
  } catch { return null; }
}
