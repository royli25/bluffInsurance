import Link from "next/link";
import { hedgeMode } from "@/lib/gemini/trading";
import { arcMode } from "@/lib/arc/client";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const nav = [
    ["/console", "Overview"],
    ["/console/events", "Events"],
    ["/console/scanner", "Market scanner"],
    ["/console/policies", "Policies and hedges"],
    ["/seatwise", "Storefront"],
  ];
  return (
    <div className="min-h-screen bg-neutral-950 text-sm text-neutral-100 md:flex">
      <aside className="flex flex-col bg-neutral-900 md:min-h-screen md:w-56 md:shrink-0">
        <Link href="/" className="px-5 py-5 text-base font-semibold">Bluff</Link>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
          {nav.map(([h, l]) => (
            <Link key={h} href={h} className="whitespace-nowrap rounded-md px-3 py-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100">{l}</Link>
          ))}
        </nav>
        <div className="mt-auto hidden space-y-2 p-5 text-neutral-500 md:block">
          <div className="flex justify-between"><span>Gemini orders</span><span className="text-neutral-300">{hedgeMode()}</span></div>
          <div className="flex justify-between"><span>Arc settlement</span><span className="text-neutral-300">{arcMode()}</span></div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-6 md:px-8">{children}</main>
    </div>
  );
}
