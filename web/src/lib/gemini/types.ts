export type Side = "home" | "away";

export interface GPrices {
  buy?: { yes?: string; no?: string };
  sell?: { yes?: string; no?: string };
  bestBid?: string;
  bestAsk?: string;
  lastTradePrice?: string;
}

export interface GContract {
  label: string;
  ticker: string;
  instrumentSymbol: string;
  prices: GPrices;
  color?: string | null;
  sportsSide?: Side | null;
}

export interface GParticipant {
  name: string;
  abbreviation: string;
  side: Side;
}

export interface GEvent {
  status?: string;
  id: string;
  title: string;
  category: "Sports" | "Weather" | "Crypto" | string;
  ticker: string;
  startTime?: string | null;
  expiryDate?: string | null;
  isLive?: boolean;
  volume?: string;
  participants: GParticipant[];
  subcategory?: string | null;
  rule: string;
  contracts: GContract[];
}

export interface MarketUniverse {
  events: GEvent[];
  source: "live" | "snapshot";
  fetchedAt: string;
}
