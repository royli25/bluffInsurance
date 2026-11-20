import type { Metadata } from "next";
import SimpleCheckout from "@/components/SimpleCheckout";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Simple checkout · Bluff",
  description: "A simple festival and NBA ticket checkout with Bluff Protect.",
};

export default async function CheckoutDemo({ searchParams }: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event } = await searchParams;
  if (event !== "nba" && event !== "festival") redirect("/demo");
  return <SimpleCheckout key={event} initialEvent={event} />;
}
