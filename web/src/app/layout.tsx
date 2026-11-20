import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bluff — ticket protection hedged on prediction markets",
  description: "Parametric live-event protection, fully hedged on Gemini prediction markets and settled in USDC on Arc.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
