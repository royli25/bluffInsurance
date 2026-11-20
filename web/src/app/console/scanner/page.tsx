import ScannerTable from "@/components/ScannerTable";
import { getMarkets } from "@/lib/gemini/client";

export const dynamic = "force-dynamic";

export default async function Scanner() {
  const u = await getMarkets();
  const rows = u.events.map((e) => ({
    ticker: e.ticker,
    title: e.title,
    category: e.category,
    league: e.category === "Sports" ? e.ticker.split("-")[0] : e.category,
    contracts: e.contracts.length,
    quoted: e.contracts.filter((c) => c.prices?.buy?.yes || c.prices?.buy?.no).length,
    volume: Number(e.volume ?? 0),
    start: e.startTime ?? e.expiryDate ?? "",
    live: !!e.isLive,
    participants: e.participants,
  }));
  const cats = rows.reduce<Record<string, number>>((m, r) => ((m[r.league] = (m[r.league] ?? 0) + 1), m), {});
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Market scanner</h1>
      <div className="flex flex-wrap gap-2">
        {Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
          <span key={k} className="rounded-md bg-neutral-900 px-2.5 py-1 text-neutral-300">{k} {v}</span>
        ))}
      </div>
      <ScannerTable rows={rows} />
    </div>
  );
}
