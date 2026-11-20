import Link from "next/link";
import { getCatalog } from "@/lib/service";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { universe, catalog } = await getCatalog();
  const contracts = universe.events.reduce((s, e) => s + e.contracts.length, 0);
  return (
    <main className="min-h-screen bg-[#0b0d12] text-white">
      <div className="mx-auto max-w-5xl px-5 py-14">
        <div className="flex items-center gap-2 text-sm text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> {universe.source === "live" ? "Live" : "Snapshot"} · {universe.events.length.toLocaleString()} Gemini markets · {contracts.toLocaleString()} contracts scanned
        </div>
        <h1 className="mt-4 text-5xl font-black tracking-tight sm:text-6xl">
          Bluff<span className="text-emerald-400">.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-xl text-zinc-300">
          Ticket protection for the nights that go wrong. Your team gets blown out, the star sits, it rains on the show — you get money back automatically.
        </p>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Every policy is fully hedged on <b className="text-white">Gemini prediction markets</b> and settled in <b className="text-white">USDC on Arc</b>. We never carry the risk; fans never touch crypto.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link href="/seatwise" className="group rounded-2xl bg-[#024ddf] p-6 transition hover:brightness-110">
            <div className="text-xs font-semibold uppercase tracking-widest text-blue-200">Fan experience</div>
            <div className="mt-2 text-2xl font-bold">Seatwise checkout →</div>
            <p className="mt-2 text-blue-100">A ticketing storefront with Bluff Protect embedded at checkout. {catalog.length} live events.</p>
          </Link>
          <Link href="/console" className="group rounded-2xl border border-zinc-700 bg-zinc-900 p-6 transition hover:border-emerald-400">
            <div className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Organizer / platform</div>
            <div className="mt-2 text-2xl font-bold">Bluff Console →</div>
            <p className="mt-2 text-zinc-400">Drop an event, scan Gemini markets, pick coverages, publish to checkout, watch the hedge book.</p>
          </Link>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            ["1", "Fan adds protection", "“Warriors lose by 13+ → 60% of your ticket back” for a few dollars at checkout."],
            ["2", "We hedge on Gemini", "Instantly buy the contract that pays $1 when that exact outcome happens. Book stays matched."],
            ["3", "Arc pays out", "Premium escrowed in USDC on Arc. When the market settles, the vault refunds the fan automatically."],
          ].map(([n, t, d]) => (
            <div key={n} className="rounded-xl border border-zinc-800 p-5">
              <div className="text-emerald-400 font-mono">0{n}</div>
              <div className="mt-1 font-semibold">{t}</div>
              <p className="mt-1 text-sm text-zinc-400">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
