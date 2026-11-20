"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type C = { id: string; name: string; emoji: string; trigger: string };
export default function SettlementPanel({
  eventId,
  coverages,
  counts,
}: {
  eventId: string;
  coverages: C[];
  counts: Record<string, number>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const active = coverages.filter((c) => counts[c.id] > 0);
  async function resolve(coverageId: string, triggered: boolean) {
    setBusy(coverageId);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, coverageId, triggered, demo: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Could not resolve the outcome.");
      setMessage(
        d.settled
          ? `${d.settled} demo ${d.settled === 1 ? "contract" : "contracts"} ${triggered ? "paid out" : "completed without a payout"}. The ledger is updated.`
          : "There are no active demo contracts left to resolve.",
      );
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="rounded-lg border border-neutral-800 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-semibold">Resolve demo outcome</h2>
        <span className="rounded border border-amber-900/60 px-2 py-0.5 text-xs text-amber-300/80">
          Simulation only
        </span>
      </div>

      {!active.length && (
        <p className="mt-5 rounded-lg bg-neutral-900 px-4 py-5 text-sm text-neutral-500">
          No active demo contracts.
        </p>
      )}
      <div className="mt-5 space-y-3">
        {active.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-neutral-900/70 p-4"
          >
            <div>
              <h3 className="text-sm">
                {c.name}{" "}
                <span className="ml-2 text-xs text-neutral-600">
                  {counts[c.id]} active
                </span>
              </h3>
              <p className="mt-1 text-xs text-neutral-500">If {c.trigger}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={!!busy}
                aria-label={`Outcome happened: ${c.name}`}
                onClick={() => resolve(c.id, true)}
                className="rounded-md bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-950 disabled:opacity-40"
              >
                {busy === c.id ? "Resolving…" : "Outcome happened"}
              </button>
              <button
                disabled={!!busy}
                aria-label={`Outcome did not happen: ${c.name}`}
                onClick={() => resolve(c.id, false)}
                className="rounded-md border border-neutral-700 px-3 py-2 text-xs text-neutral-400 disabled:opacity-40"
              >
                Did not happen
              </button>
            </div>
          </div>
        ))}
      </div>
      {message && (
        <p role="status" className="mt-4 text-sm text-emerald-300">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
