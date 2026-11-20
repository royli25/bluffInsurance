import { notFound } from "next/navigation";
import Checkout from "@/components/Checkout";
import { getEvent, offeredCoverages } from "@/lib/service";
import { quote } from "@/lib/coverage";
export const dynamic = "force-dynamic";
export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tier?: string; qty?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { ev } = await getEvent(id);
  if (!ev) notFound();
  const tier = ev.tiers.find((t) => t.id === sp.tier) ?? ev.tiers[0];
  const requested = Number(sp.qty ?? 2);
  const qty = Number.isInteger(requested)
    ? Math.max(1, Math.min(6, requested))
    : 2;
  const coverages = await offeredCoverages(ev, "home");
  const initialRows = coverages.map((coverage) => ({
    coverage,
    quote: quote(coverage, tier.price * qty, coverage.defaultRefundPct),
  }));
  return <Checkout ev={ev} tier={tier} qty={qty} initialRows={initialRows} />;
}
