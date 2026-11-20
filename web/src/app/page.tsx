import Link from "next/link";
import { getCatalog } from "@/lib/service";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { universe, catalog } = await getCatalog();
  const contracts = universe.events.reduce((s, e) => s + e.contracts.length, 0);
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-5xl space-y-10 px-5 py-16">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold">Bluff</h1>
          <p className="max-w-2xl text-xl text-neutral-300">Ticket protection for the nights that go wrong. Your team gets blown out, the star sits, the show gets rained on, and you get money back automatically.</p>
          <p className="max-w-2xl text-neutral-400">Every policy is hedged on Gemini prediction markets and settled in USDC on Arc. {universe.events.length.toLocaleString()} markets and {contracts.toLocaleString()} contracts indexed right now.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/seatwise" className="space-y-2 rounded-lg bg-neutral-900 p-6 hover:bg-neutral-800">
            <div className="text-xl font-semibold">Storefront</div>
            <p className="text-neutral-400">The fan side. A ticketing checkout with Bluff Protect built in, across {catalog.length} live events.</p>
          </Link>
          <Link href="/console" className="space-y-2 rounded-lg bg-neutral-900 p-6 hover:bg-neutral-800">
            <div className="text-xl font-semibold">Console</div>
            <p className="text-neutral-400">The organizer side. Drop an event, scan markets, choose covers, publish to checkout.</p>
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Fan adds protection", "Warriors lose by 13 or more and 60% of the ticket comes back, for a few dollars at checkout."],
            ["We hedge on Gemini", "We buy the contract that pays $1 when that exact outcome happens, so the book stays matched."],
            ["Arc pays out", "The premium sits in a USDC vault on Arc. When the market settles, the fan is refunded automatically."],
          ].map(([t, d]) => (
            <div key={t} className="space-y-2 rounded-lg bg-neutral-900 p-5">
              <div className="font-semibold">{t}</div>
              <p className="text-neutral-400">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
