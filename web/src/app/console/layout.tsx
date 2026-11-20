import Link from "next/link";
import { hedgeMode } from "@/lib/gemini/trading";
import { arcMode } from "@/lib/arc/client";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const nav = [
    ["/console", "Overview"],
    ["/console/events", "Events"],
    ["/console/scanner", "Market Scanner"],
    ["/console/policies", "Policies & Hedges"],
  ];
  return (
    <div className="min-h-screen bg-[#0b0d12] text-zinc-100 md:flex">
      <aside className="border-b border-zinc-800 md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="px-5 py-4">
          <Link href="/" className="text-xl font-black">Bluff<span className="text-emerald-400">.</span> <span className="text-sm font-medium text-zinc-500">console</span></Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
          {nav.map(([h, l]) => (
            <Link key={h} href={h} className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white">{l}</Link>
          ))}
          <Link href="/seatwise" className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-blue-300 hover:bg-zinc-800">↗ Seatwise storefront</Link>
        </nav>
        <div className="hidden space-y-1.5 px-5 py-4 text-[11px] text-zinc-500 md:block">
          <div>Gemini orders: <span className={hedgeMode() === "live" ? "text-emerald-400" : "text-amber-400"}>{hedgeMode()}</span></div>
          <div>Arc settlement: <span className={arcMode() === "live" ? "text-emerald-400" : "text-amber-400"}>{arcMode()}</span></div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-6 md:px-8">{children}</main>
    </div>
  );
}
