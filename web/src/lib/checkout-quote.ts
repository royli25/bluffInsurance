import type { Coverage, Quote } from "./coverage";

export interface CheckoutQuote {
  id: string;
  eventId: string;
  tierId: string;
  qty: number;
  rooting: "home" | "away";
  offerVersion: string;
  createdAt: string;
  expiresAt: string;
  marketFetchedAt: string;
  source: "live" | "estimate";
  options: { coverage: Coverage; price: Quote }[];
}

export function validateCheckoutQuote(
  q: CheckoutQuote | undefined,
  input: { eventId: string; tierId: string; qty: number; rooting: string },
  offerVersion: string,
  now = Date.now(),
) {
  if (!q || Date.parse(q.expiresAt) <= now)
    throw new Error("Quote expired. Refresh prices before purchasing.");
  if (q.eventId !== input.eventId || q.tierId !== input.tierId || q.qty !== input.qty || q.rooting !== input.rooting)
    throw new Error("Your tickets changed. Refresh prices before purchasing.");
  if (q.offerVersion !== offerVersion)
    throw new Error("Protection changed. Refresh availability before purchasing.");
  return q;
}
