import { notFound } from "next/navigation";
import SeatwiseHeader from "@/components/SeatwiseHeader";
import Checkout from "@/components/Checkout";
import { getEvent } from "@/lib/service";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tier?: string; qty?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { ev } = await getEvent(id);
  if (!ev) notFound();
  const tier = ev.tiers.find((t) => t.id === sp.tier) ?? ev.tiers[0];
  return (
    <div className="min-h-screen bg-zinc-100">
      <SeatwiseHeader />
      <Checkout ev={ev} tier={tier} qty={Number(sp.qty ?? 2)} />
    </div>
  );
}
