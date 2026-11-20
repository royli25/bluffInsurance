"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TicketEvent } from "@/lib/catalog";
import { quote, type Coverage } from "@/lib/coverage";
import type { OfferConfig } from "@/lib/store";
import { usd } from "@/lib/format";
export default function CoverageBuilder({
  ev,
  coverages,
  initial,
}: {
  ev: TicketEvent;
  coverages: Coverage[];
  initial: OfferConfig;
}) {
  const router = useRouter();
  const [cfg, setCfg] = useState(initial.coverages);
  const [published, setPublished] = useState(initial.published);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savedCfg, setSavedCfg] = useState(JSON.stringify(initial.coverages));
  const dirty = savedCfg !== JSON.stringify(cfg);
  const [tierId, setTierId] = useState(ev.tiers[0].id);
  const tier = ev.tiers.find((t) => t.id === tierId)!;
  const selected = coverages.filter((c) => cfg[c.id]?.enabled);
  async function save(pub: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: ev.id,
          published: pub,
          coverages: cfg,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Could not save protection.");
      setPublished(pub);
      setSavedCfg(JSON.stringify(cfg));
      setMessage(pub ? "Protection published." : "Protection unpublished.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-lg border border-neutral-800 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Protection options</h2>
        </div>
        <select
          aria-label="Preview ticket tier"
          value={tierId}
          onChange={(e) => setTierId(e.target.value)}
          className="rounded-md bg-neutral-900 px-3 py-2 text-xs text-neutral-400"
        >
          {ev.tiers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {usd(t.price)}
            </option>
          ))}
        </select>
      </div>
      <fieldset
        disabled={busy}
        className="mt-5 grid min-w-0 gap-3 lg:grid-cols-2"
      >
        {coverages.map((c) => {
          const st = cfg[c.id] ?? {
            enabled: false,
            refundPct: c.defaultRefundPct,
          };
          const q = quote(c, tier.price, st.refundPct);
          return (
            <div
              key={c.id}
              className={`rounded-lg border p-4 ${st.enabled ? "border-neutral-600 bg-neutral-900/60" : "border-neutral-800"}`}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={st.enabled}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      [c.id]: { ...st, enabled: e.target.checked },
                    })
                  }
                  className="mt-1 h-4 w-4 accent-emerald-300"
                />
                <span>
                  <span className="font-semibold">{c.name}</span>
                  <span className="mt-1 block text-xs leading-5 text-neutral-500">
                    If {c.trigger}
                  </span>
                </span>
              </label>
              <label
                className={`mt-5 flex items-center gap-3 text-xs ${st.enabled ? "text-neutral-400" : "text-neutral-600"}`}
              >
                <span className="min-w-24">Refund {st.refundPct}%</span>
                <input
                  aria-label={`${c.name} refund percentage`}
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  disabled={!st.enabled}
                  value={st.refundPct}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      [c.id]: { ...st, refundPct: Number(e.target.value) },
                    })
                  }
                  className="min-w-0 flex-1 accent-neutral-300"
                />
              </label>
              <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-neutral-800 pt-3 text-xs text-neutral-500">
                <span>
                  Estimated premium{" "}
                  <strong className="text-neutral-300">{usd(q.premium)}</strong>
                </span>
                <span>
                  Potential payout{" "}
                  <strong className="text-neutral-300">{usd(q.payout)}</strong>
                </span>
              </div>
              {c.hedgeType === "partial" && (
                <p className="mt-3 text-xs text-amber-300/70">
                  Partial hedge · remaining risk backed by reserves
                </p>
              )}
            </div>
          );
        })}
      </fieldset>
      {!coverages.length && (
        <p className="mt-5 text-sm text-amber-300">
          No matching protection markets are available for this event.
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => save(true)}
          disabled={busy || !selected.length}
          className="rounded-md bg-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-950 disabled:opacity-30"
        >
          {busy
            ? "Saving…"
            : published
              ? dirty
                ? "Save changes"
                : "Save protection"
              : "Publish protection"}
        </button>
        {published && (
          <Link
            href={`/demo/checkout?event=${ev.id}`}
            className="rounded-md border border-neutral-700 px-4 py-2.5 text-sm hover:bg-neutral-800"
          >
            Open demo checkout →
          </Link>
        )}
        {published && (
          <button
            disabled={busy}
            onClick={() => save(false)}
            className="ml-auto text-xs text-neutral-600 hover:text-neutral-300"
          >
            Unpublish
          </button>
        )}
      </div>
      {dirty && published && (
        <p className="mt-3 text-xs text-amber-300">
          Save your changes to update the checkout.
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-xs text-emerald-300">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
