import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import SimpleCheckout from "@/components/SimpleCheckout";
import { getCatalog, getEvent, offeredCoverages } from "@/lib/service";
import { db } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout" };

export default async function CustomerCheckout({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event: id } = await searchParams;
  if (!id) redirect("/tickets");
  if (id === "nba" || id === "festival") {
    const { catalog } = await getCatalog();
    const event = catalog.find((event) => id === "nba" ? event.league === "NBA" : event.kind === "concert");
    redirect(event ? `/tickets/checkout?event=${encodeURIComponent(event.id)}` : "/tickets");
  }
  const { ev } = await getEvent(id);
  if (!ev) notFound();
  const options = db.offer(id)?.published ? await offeredCoverages(ev, "home") : [];
  return <SimpleCheckout key={id} event={ev} options={options} />;
}
