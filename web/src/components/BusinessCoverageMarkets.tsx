"use client";
import Link from "next/link";
import Icon from "./TicketmasterIcon";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EventMarks } from "./TeamMarks";
import MarketProviderOptions from "./MarketProviderOptions";
import { dateParts } from "@/lib/format";
import type { Coverage, CoverageId } from "@/lib/coverage";
import type { TicketEvent } from "@/lib/catalog";
import type { OfferConfig } from "@/lib/store";
import type { MarketProvider, MarketScan } from "@/lib/markets/types";
import styles from "./BusinessCoverageMarkets.module.css";
export type ManagedCoverageEvent = { event: TicketEvent; offer: OfferConfig; coverages: Coverage[] };
function EventMarkets({ item, first }: { item: ManagedCoverageEvent; first: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(first);
  const [offer, setOffer] = useState(item.offer);
  const [scan, setScan] = useState<MarketScan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let controller: AbortController | undefined;
    const refresh = async () => {
      controller?.abort(); controller = new AbortController();
      setLoading(true);
      try {
        const r = await fetch(`/api/market-quotes?eventId=${encodeURIComponent(item.event.id)}`, { signal: controller.signal });
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Prices unavailable");
        if (!controller.signal.aborted) setScan(body);
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => { controller?.abort(); window.clearInterval(timer); };
  }, [open, item.event.id]);
  useEffect(() => {
    if (!saving && Date.parse(item.offer.updatedAt) > Date.parse(offer.updatedAt)) setOffer(item.offer);
  }, [saving, item.offer, offer.updatedAt]);
  async function update(id: CoverageId, enabled?: boolean, provider?: MarketProvider, on?: boolean) {
    if (saving) return;
    const previous = offer;
    const state = previous.coverages[id] ?? { enabled: false, refundPct: item.coverages.find((c) => c.id === id)!.defaultRefundPct };
    const changed = { ...state, ...(enabled === undefined ? {} : { enabled }), ...(provider ? { providers: { ...state.providers, [provider]: on } } : {}) };
    // A coverage with no enabled provider is off, and can be re-enabled later.
    const supported: MarketProvider[] = item.event.league === "NBA" && id === "team-loses" ? ["gemini", "kalshi"] : ["gemini"];
    if (enabled && supported.every((p) => changed.providers?.[p] === false)) changed.providers = { ...changed.providers, [supported[0]]: true };
    if (provider && on) changed.enabled = true;
    if (provider && supported.every((p) => changed.providers?.[p] === false)) changed.enabled = false;
    const next = { ...previous, coverages: { ...previous.coverages, [id]: changed } };
    next.published = Object.values(next.coverages).some((c) => c?.enabled);
    setOffer(next); setSaving(true); setError("");
    try {
      const r = await fetch("/api/offers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...next, expectedUpdatedAt: previous.updatedAt }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Could not save providers");
      setOffer(data.offer); router.refresh();
    } catch (e) { setOffer(previous); setError((e as Error).message); }
    finally { setSaving(false); }
  }
  return <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className={styles.event}>
    <summary className={styles.eventHeading}>
      <EventMarks ev={item.event} />
      <span className={styles.eventInfo}><strong>{item.event.title}</strong><span>{dateParts(item.event.startTime).long} · {item.event.venue}</span></span>
      <span className={styles.count}>{Object.values(offer.coverages).filter((c) => c?.enabled).length} markets on</span>
      <Icon name="chevron-down" className={`business-icon ${styles.disclosure}`} />
    </summary>
    <div className={styles.coverages}>
      {item.coverages.map((coverage) => {
        const config = offer.coverages[coverage.id] ?? { enabled: false, refundPct: coverage.defaultRefundPct };
        return <section className={styles.coverage} key={coverage.id}>
          <label className={styles.coverageHeading}>
            <input type="checkbox" role="switch" aria-label={`${coverage.name} for ${item.event.title}`} checked={config.enabled} disabled={saving} onChange={(e) => update(coverage.id, e.target.checked)} />
            <strong>{coverage.name}</strong><span>{config.refundPct}% back</span>
          </label>
          <MarketProviderOptions coverage={coverage} total={item.event.tiers[0].price} refundPct={config.refundPct}
            settings={config.providers} disabled={saving} inactive={!config.enabled} loading={loading}
            candidates={scan?.markets.find((m) => m.coverage.id === coverage.id)?.candidates}
            onChange={(provider, on) => update(coverage.id, undefined, provider, on)} />
        </section>;
      })}
    </div>
    <div className={styles.eventFooter}>
      <Link href={`/console/events/${item.event.id}`}>Manage event →</Link>
      <span>{loading ? "Checking markets…" : scan ? `Checked ${new Date(scan.scannedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}</span>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </details>;
}
export default function BusinessCoverageMarkets({ events }: { events: ManagedCoverageEvent[] }) {
  if (!events.length) return null;
  return <section className={styles.panel} aria-label="Event coverage markets">
    <div className={styles.heading}><h2>Coverage markets</h2><span>30s refresh</span></div>
    {events.map((item, index) => <EventMarkets key={item.event.id} item={item} first={index === 0} />)}
  </section>;
}
