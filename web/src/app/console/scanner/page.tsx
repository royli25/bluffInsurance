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
  }));
  const cats = rows.reduce<Record<string, number>>((m, r) => ((m[r.league] = (m[r.league] ?? 0) + 1), m), {});
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Market Scanner</h1>
        <p className="text-sm text-zinc-500">Every active Gemini prediction market ({u.source}, {rows.length} events, {rows.reduce((s, r) => s + r.contracts, 0).toLocaleString()} contracts). Bluff indexes these to find hedges for any live event.</p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
          <span key={k} className="rounded-full bg-zinc-800 px-2.5 py-1">{k} <b>{v}</b></span>
        ))}
      </div>
      <ScannerTable rows={rows} />
    </div>
  );
}
