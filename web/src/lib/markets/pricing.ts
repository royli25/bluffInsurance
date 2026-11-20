import { PRICING, quote, type Coverage } from "../coverage";
import type { BookLevel, MarketCandidate, ProviderBook, ProviderSettings } from "./types";
const cents = (n: number) => Math.round(n * 100) / 100;
export function parseLevels(raw: unknown, complement = false): BookLevel[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((level) => {
    if (!Array.isArray(level) || level.length < 2) return [];
    const p = Number(level[0]), quantity = Number(level[1]);
    const price = complement ? Math.round((1 - p) * 10000) / 10000 : p;
    return Number.isFinite(price) && price > 0 && price < 1 && Number.isFinite(quantity) && quantity > 0 ? [{ price, quantity }] : [];
  }).sort((a, b) => a.price - b.price);
}
/** Walk the ask side for the full liability. A cheap, shallow level cannot win. */
export function priceBook(coverage: Coverage, total: number, book: ProviderBook, now = Date.now()): MarketCandidate {
  const unavailable = (reason: string): MarketCandidate => ({ provider: book.provider, state: "unavailable", reason });
  if (!Number.isFinite(Date.parse(book.observedAt)) || now - Date.parse(book.observedAt) > 15_000 || Date.parse(book.observedAt) - now > 1000)
    return unavailable("Price is stale");
  if (!Number.isFinite(book.feeRate) || book.feeRate < 0 || book.feeRate > 1) return unavailable("Fee schedule unavailable");
  const base = quote(coverage, total);
  let remaining = base.contracts, cost = 0, fee = 0, limit = 0;
  for (const level of [...book.asks].sort((a, b) => a.price - b.price)) {
    if (!Number.isFinite(level.price) || !Number.isFinite(level.quantity) || level.price <= 0 || level.price >= 1 || level.quantity <= 0) continue;
    const take = Math.min(remaining, level.quantity);
    cost += take * level.price;
    fee += book.feeRate * take * level.price * (1 - level.price);
    remaining -= take;
    limit = level.price;
    if (remaining < 0.000001) break;
  }
  if (remaining > 0.000001 || !limit) return unavailable("Insufficient order-book depth");
  const precision = book.provider === "kalshi" ? 10000 : 100;
  const rawFee = book.provider === "kalshi" ? Math.ceil((cost + fee - 1e-10) * precision) / precision - cost : Math.ceil((fee - 1e-10) * precision) / precision;
  const exchangeFee = Math.round(rawFee * 10000) / 10000;
  const hedgeCost = Math.round((cost + exchangeFee) * 10000) / 10000;
  const premium = cents(Math.max(PRICING.minPremium, hedgeCost * (1 + PRICING.margin) + PRICING.fee));
  const selected: Coverage = { ...coverage, probability: cost / base.contracts, hedge: {
    ...coverage.hedge, provider: book.provider, instrumentSymbol: book.symbol, price: limit, indicative: false,
  } };
  return { provider: book.provider, state: "live", coverage: selected, observedAt: book.observedAt, exchangeFee, book,
    price: { ...base, hedgeCost, exchangeFee, premium, margin: cents(premium - hedgeCost) } };
}
/** Prefer current order books; estimates never outrank a fresh executable quote. */
export function selectBest(candidates: MarketCandidate[], settings: ProviderSettings = {}) {
  const allowed = candidates.filter((c) => settings[c.provider] !== false && c.price && c.coverage);
  const live = allowed.filter((c) => c.state === "live");
  return (live.length ? live : allowed.filter((c) => c.state === "estimate"))
    .sort((a, b) => a.price!.premium - b.price!.premium || a.provider.localeCompare(b.provider))[0];
}
