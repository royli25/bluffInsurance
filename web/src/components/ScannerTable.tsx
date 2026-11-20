"use client";
import { useMemo, useState } from "react";

type Row = { ticker: string; title: string; category: string; league: string; contracts: number; quoted: number; volume: number; start: string; live: boolean };

export default function ScannerTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [onlyQuoted, setOnlyQuoted] = useState(true);
  const list = useMemo(() => {
    const t = q.toLowerCase();
    return rows
      .filter((r) => (!t || r.title.toLowerCase().includes(t) || r.ticker.toLowerCase().includes(t)) && (!onlyQuoted || r.quoted > 0))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 150);
  }, [rows, q, onlyQuoted]);
  return (
    <div className="rounded-xl border border-zinc-800">
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800 p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search markets (team, city, ticker)…" className="min-w-60 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={onlyQuoted} onChange={(e) => setOnlyQuoted(e.target.checked)} /> only markets with live quotes</label>
        <span className="text-xs text-zinc-500">{list.length} shown</span>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#0b0d12] text-left text-xs uppercase text-zinc-500">
            <tr><th className="px-3 py-2">Market</th><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-right">Contracts</th><th className="px-3 py-2 text-right">Quoted</th><th className="px-3 py-2 text-right">Volume</th></tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.ticker} className="border-t border-zinc-900">
                <td className="px-3 py-1.5">{r.live && <span className="mr-1 text-[10px] font-bold text-red-400">LIVE</span>}{r.title}<div className="font-mono text-[10px] text-zinc-600">{r.ticker}</div></td>
                <td className="px-3 py-1.5 text-zinc-400">{r.league}</td>
                <td className="px-3 py-1.5 text-right">{r.contracts}</td>
                <td className="px-3 py-1.5 text-right">{r.quoted}</td>
                <td className="px-3 py-1.5 text-right text-zinc-400">${Math.round(r.volume).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
