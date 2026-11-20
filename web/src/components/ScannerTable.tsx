"use client";
import { useMemo, useState } from "react";
import TeamMarks from "@/components/TeamMarks";

type Row = { ticker: string; title: string; category: string; league: string; contracts: number; quoted: number; volume: number; start: string; live: boolean; participants: { abbreviation: string; side: string }[] };

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
    <div className="rounded-lg bg-neutral-900">
      <div className="flex flex-wrap items-center gap-3 p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search markets" className="min-w-60 flex-1 rounded-md bg-neutral-800 px-3 py-2 placeholder:text-neutral-500" />
        <label className="flex items-center gap-2 text-neutral-300"><input type="checkbox" className="accent-neutral-200" checked={onlyQuoted} onChange={(e) => setOnlyQuoted(e.target.checked)} /> Quoted only</label>
        <span className="text-neutral-400">{list.length} shown</span>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-neutral-900 text-left text-neutral-400">
            <tr><th className="px-3 py-2 font-normal">Market</th><th className="px-3 py-2 font-normal">Type</th><th className="px-3 py-2 text-right font-normal">Contracts</th><th className="px-3 py-2 text-right font-normal">Quoted</th><th className="px-3 py-2 text-right font-normal">Volume</th></tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.ticker} className="border-t border-neutral-800">
                <td className="px-3 py-2"><div className="flex items-center gap-3"><TeamMarks league={r.league} participants={r.participants} /><div>{r.title}{r.live && <span className="ml-2 text-red-400">Live</span>}<div className="font-mono text-neutral-500">{r.ticker}</div></div></div></td>
                <td className="px-3 py-2 text-neutral-400">{r.league}</td>
                <td className="px-3 py-2 text-right">{r.contracts}</td>
                <td className="px-3 py-2 text-right">{r.quoted}</td>
                <td className="px-3 py-2 text-right text-neutral-400">${Math.round(r.volume).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
