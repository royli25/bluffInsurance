"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type C = { id: string; name: string; emoji: string; trigger: string };

export default function SettlementPanel({ eventId, coverages, counts }: { eventId: string; coverages: C[]; counts: Record<string, number> }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  async function settle(coverageId: string, triggered: boolean) {
    setMsg("Posting settlement to the Arc vault");
    const r = await fetch("/api/settle", { method: "POST", body: JSON.stringify({ eventId, coverageId, triggered }) });
    const d = await r.json();
    setMsg(d.error ? d.error : `Settled ${d.settled} polic${d.settled === 1 ? "y" : "ies"}${triggered ? `, ${"$" + (d.hedgeProceeds ?? 0).toFixed(2)} hedge proceeds, refunds sent` : ", expired"}`);
    router.refresh();
  }
  return (
    <section className="rounded-lg bg-neutral-900 p-4">
      <h2 className="text-base">Settlement</h2>
      <div className="mt-3 space-y-2">
        {coverages.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-md bg-neutral-800 px-3 py-2">
            <span>{c.emoji} {c.name}</span>
            <span className="text-neutral-400">{counts[c.id] ?? 0} active</span>
            <span className="ml-auto flex gap-2">
              <button disabled={!counts[c.id]} onClick={() => settle(c.id, true)} className="rounded-md bg-neutral-100 px-3 py-1 text-neutral-950 disabled:opacity-30">Happened</button>
              <button disabled={!counts[c.id]} onClick={() => settle(c.id, false)} className="rounded-md bg-neutral-700 px-3 py-1 text-neutral-100 disabled:opacity-30">Didn&apos;t happen</button>
            </span>
          </div>
        ))}
      </div>
      {msg && <div className="mt-3 text-emerald-400">{msg}</div>}
    </section>
  );
}
