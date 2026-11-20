import type { Metadata } from "next";
import "./ticketmaster.css";
export const metadata: Metadata = {
  title: "Ticketmaster + Bluff Protect",
  description:
    "Discover live events and add automatic ticket protection with Bluff. Independent interface demo.",
};
export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="tm-root">{children}</div>;
}
