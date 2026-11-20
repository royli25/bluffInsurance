import { redirect } from "next/navigation";

export default async function LegacyCheckout({ searchParams }: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event } = await searchParams;
  redirect(event ? `/tickets/checkout?event=${encodeURIComponent(event)}` : "/tickets");
}
