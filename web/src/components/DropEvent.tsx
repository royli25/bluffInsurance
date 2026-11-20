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
    <section className="rounded-lg bg-neutral-900 p-4">
      <h2 className="text-base">Drop an event</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["sports", "concert"] as const).map((k) => (
          <button key={k} onClick={() => { setKind(k); setMatches(null); }} className={`rounded-md px-3 py-1.5 ${kind === k ? "bg-neutral-100 text-neutral-950" : "bg-neutral-800 text-neutral-300"}`}>{k === "sports" ? "Game" : "Outdoor concert"}</button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={kind === "sports" ? "Warriors vs Celtics" : "Artist or show"} className="min-w-60 flex-1 rounded-md bg-neutral-800 px-3 py-2 placeholder:text-neutral-500" />
        {kind === "concert" && <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="City" className="w-48 rounded-md bg-neutral-800 px-3 py-2 placeholder:text-neutral-500" />}
        <button onClick={scan} disabled={busy || !query} className="rounded-md bg-neutral-100 px-4 py-2 font-semibold text-neutral-950 disabled:opacity-40">{busy ? "Scanning" : "Scan Gemini markets"}</button>
      </div>
      {matches && (
        <div className="mt-3 space-y-2">
          {matches.length === 0 && <div className="text-amber-300">No hedgeable Gemini markets found.</div>}
          {matches.map((m) => (
            <div key={m.ticker} className="flex flex-wrap items-center gap-3 rounded-md bg-neutral-800 px-3 py-2">
              <div>
                <div>{m.title}</div>
                <div className="font-mono text-neutral-400">{m.ticker}, {new Date(m.startTime).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} CT</div>
              </div>
              <button onClick={() => create(m)} className="ml-auto rounded-md bg-neutral-100 px-3 py-1.5 text-neutral-950">Build coverage</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
