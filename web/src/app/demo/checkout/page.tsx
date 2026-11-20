import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SimpleCheckout from "@/components/SimpleCheckout";
import { getCatalog, getEvent, offeredCoverages } from "@/lib/service";
import { db } from "@/lib/store";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Demo checkout · Bluff",
  description:
    "Buy protection and follow the contract through the business dashboard.",
};
export default async function CheckoutDemo({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event: id } = await searchParams;
  if (!id) redirect("/console/events?add=1");
  // Old demo links now select a matching market-backed event rather than
  // pretending a different fixture event has a live hedge market.
  if (id === "nba" || id === "festival") {
    const { catalog } = await getCatalog();
    const event = catalog.find((e) =>
      id === "nba" ? e.league === "NBA" : e.kind === "concert",
    );
    if (event) redirect(`/demo/checkout?event=${event.id}`);
    redirect("/console/events?add=1");
  }
  const { ev } = await getEvent(id);
  if (!ev) notFound();
  const options = await offeredCoverages(ev, "home");
  if (!db.offer(id)?.published || !options.length)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-neutral-950 px-6 text-center text-neutral-100">
        <span className="text-xs text-neutral-500">BLUFF CHECKOUT</span>
        <h1 className="text-2xl font-semibold">
          Protection is not published yet.
        </h1>
        <p className="text-sm text-neutral-500">
          Choose the protection options for {ev.title} before trying the demo
          checkout.
        </p>
        <Link
          className="rounded-md bg-white px-4 py-3 text-sm text-neutral-950"
          href={`/console/events/${id}`}
        >
          Set up protection
        </Link>
      </main>
    );
  return <SimpleCheckout key={id} event={ev} options={options} />;
}
