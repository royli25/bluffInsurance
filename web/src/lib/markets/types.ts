import type { Coverage, Quote } from "../coverage";
export type MarketProvider = "gemini" | "kalshi";
export const PROVIDERS: MarketProvider[] = ["gemini", "kalshi"];
export const providerName = (p: MarketProvider) => p === "kalshi" ? "Kalshi" : "Gemini";
export type ProviderSettings = Partial<Record<MarketProvider, boolean>>;
export interface BookLevel { price: number; quantity: number }
export interface ProviderBook {
  provider: MarketProvider;
  symbol: string;
  observedAt: string;
  asks: BookLevel[];
  feeRate: number;
  rules?: string;
}
export interface MarketCandidate {
  provider: MarketProvider;
  state: "live" | "estimate" | "unavailable";
  coverage?: Coverage;
  price?: Quote;
  observedAt?: string;
  exchangeFee?: number;
  book?: ProviderBook;
  reason?: string;
}
export interface CoverageMarket {
  coverage: Coverage;
  candidates: MarketCandidate[];
  selected?: MarketProvider;
}
export interface MarketScan { scannedAt: string; markets: CoverageMarket[] }
