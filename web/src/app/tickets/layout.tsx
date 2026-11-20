import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Bluff Tickets", template: "%s · Bluff Tickets" },
  description: "Find your next live event, choose your tickets, and add protection for a little more peace of mind.",
};

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
