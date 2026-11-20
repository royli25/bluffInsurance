"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Match = { ticker: string; title: string; startTime: string; score: number; related: number };

export default function DropEvent() {
  const router = useRouter();
  const [kind, setKind] = useState<"sports" | "concert">("sports");
  const [query, setQuery] = useState("");
  const [venue, setVenue] = useState("");
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function scan() {
    setBusy(true);
    const r = await fetch("/api/events/match", { method: "POST", body: JSON.stringify({ query, kind, city: kind === "concert" ? venue || query : undefined }) });
    setMatches((await r.json()).matches);
    setBusy(false);
  }
  async function create(m: Match) {
    const r = await fetch("/api/events", {
      method: "POST",
      body: JSON.stringify({ geminiTicker: m.ticker, kind, title: kind === "sports" ? query : undefined, artist: kind === "concert" ? query : undefined, city: kind === "concert" ? venue : undefined }),
    });
    const d = await r.json();
    if (d.event) router.push(`/console/events/${d.event.id}`);
  }

  return (
    <section className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4">
      <h2 className="font-semibold">Drop an event</h2>
      <p className="text-xs text-zinc-400">Describe your event; we scan every active Gemini market and find the ones that can hedge it.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["sports", "concert"] as const).map((k) => (
          <button key={k} onClick={() => { setKind(k); setMatches(null); }} className={`rounded-full px-3 py-1 text-sm ${kind === k ? "bg-emerald-500 font-semibold text-black" : "bg-zinc-800 text-zinc-300"}`}>{k === "sports" ? "🏟️ Game" : "🎤 Outdoor concert"}</button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={kind === "sports" ? "e.g. Warriors vs Celtics" : "Artist / show name"} className="min-w-60 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" />
        {kind === "concert" && <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="City (e.g. Austin)" className="w-48 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" />}
        <button onClick={scan} disabled={busy || !query} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">{busy ? "Scanning…" : "Scan Gemini markets"}</button>
      </div>
      {matches && (
        <div className="mt-3 space-y-2">
          {matches.length === 0 && <div className="text-sm text-amber-300">No hedgeable Gemini markets found for that event.</div>}
          {matches.map((m) => (
            <div key={m.ticker} className="flex flex-wrap items-center gap-3 rounded-lg bg-zinc-900 px-3 py-2 text-sm">
              <div>
                <div className="font-medium">{m.title}</div>
                <div className="font-mono text-[11px] text-zinc-500">{m.ticker} · {m.related} related markets · {new Date(m.startTime).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} CT</div>
              </div>
              <button onClick={() => create(m)} className="ml-auto rounded bg-zinc-100 px-3 py-1 text-xs font-bold text-black">Use this → build coverage</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
