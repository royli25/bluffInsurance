"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type C = { id: string; name: string; emoji: string; trigger: string };

export default function SettlementPanel({ eventId, coverages, counts }: { eventId: string; coverages: C[]; counts: Record<string, number> }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  async function settle(coverageId: string, triggered: boolean) {
    setMsg("Posting settlement to Arc vault…");
    const r = await fetch("/api/settle", { method: "POST", body: JSON.stringify({ eventId, coverageId, triggered }) });
    const d = await r.json();
    setMsg(d.error ? d.error : `Settled ${d.settled} polic${d.settled === 1 ? "y" : "ies"}${triggered ? ` · hedge proceeds $${(d.hedgeProceeds ?? 0).toFixed(2)} → refunds sent` : " · expired"}`);
    router.refresh();
  }
  return (
    <section className="rounded-xl border border-zinc-800 p-4">
      <h2 className="font-semibold">③ Settlement oracle</h2>
      <p className="mt-1 text-xs text-zinc-500">In production the oracle polls Gemini for market resolution and calls <span className="font-mono">settleMarket()</span> on the Arc vault. For the demo, resolve outcomes manually:</p>
      <div className="mt-3 space-y-2">
        {coverages.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-900/60 px-3 py-2 text-sm">
            <span>{c.emoji} {c.name}</span>
            <span className="text-zinc-500">“{c.trigger}”</span>
            <span className="text-xs text-zinc-500">· {counts[c.id] ?? 0} active</span>
            <span className="ml-auto flex gap-2">
              <button disabled={!counts[c.id]} onClick={() => settle(c.id, true)} className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold disabled:opacity-30">Happened → pay out</button>
              <button disabled={!counts[c.id]} onClick={() => settle(c.id, false)} className="rounded bg-zinc-700 px-2.5 py-1 text-xs font-semibold disabled:opacity-30">Didn&apos;t happen</button>
            </span>
          </div>
        ))}
      </div>
      {msg && <div className="mt-2 text-sm text-emerald-400">{msg}</div>}
    </section>
  );
}
