"use client";
import Link from "next/link";
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
function EventMarkets({ item }: { item: ManagedCoverageEvent }) {
  const router = useRouter();
  const [offer, setOffer] = useState(item.offer);
  const [scan, setScan] = useState<MarketScan | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextRefresh, setNextRefresh] = useState(0);
  const [now, setNow] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [marketError, setMarketError] = useState("");
  useEffect(() => {
    let controller: AbortController | undefined;
    let timer: number | undefined;
    const refresh = async () => {
      controller?.abort(); controller = new AbortController();
      setLoading(true);
      try {
        const r = await fetch(`/api/market-quotes?eventId=${encodeURIComponent(item.event.id)}`, { signal: controller.signal });
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Prices unavailable");
        if (!controller.signal.aborted) { setScan(body); setMarketError(""); }
      } catch (e) {
        if (!controller.signal.aborted) setMarketError((e as Error).message);
      } finally {
        if (!controller.signal.aborted) {
          const at = Date.now(); setNow(at); setNextRefresh(at + 30_000); setLoading(false);
          timer = window.setTimeout(refresh, 30_000);
        }
      }
    };
    void refresh();
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { controller?.abort(); window.clearTimeout(timer); window.clearInterval(clock); };
  }, [item.event.id]);
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
    await persist(next, previous);
  }
  async function persist(next: OfferConfig, previous = offer) {
    setOffer(next); setSaving(true); setError("");
    try {
      const r = await fetch("/api/offers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...next, expectedUpdatedAt: previous.updatedAt }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Could not save coverage");
      setOffer(data.offer); router.refresh();
    } catch (e) { setOffer(previous); setError((e as Error).message); }
    finally { setSaving(false); }
  }
  async function setAll(enabled: boolean) {
    if (saving) return;
    const coverages: OfferConfig["coverages"] = {};
    for (const coverage of item.coverages) {
      const config = offer.coverages[coverage.id] ?? { enabled: false, refundPct: coverage.defaultRefundPct };
      const supported = item.event.league === "NBA" && coverage.id === "team-loses" ? ["gemini", "kalshi"] as const : ["gemini"] as const;
      const providers = { ...config.providers };
      if (enabled && supported.every((provider) => providers[provider] === false)) providers[supported[0]] = true;
      coverages[coverage.id] = { ...config, enabled, providers };
    }
    await persist({ ...offer, published: enabled && item.coverages.length > 0, coverages });
  }
  const active = offer.published ? Object.values(offer.coverages).filter((config) => config?.enabled).length : 0;
  const remaining = Math.max(0, Math.ceil((nextRefresh - now) / 1000));
  return <article className={styles.event} aria-label={`${item.event.title} coverage`}>
    <header className={styles.eventHeading}>
      <span className={styles.eventMarks}><EventMarks ev={item.event} /></span>
      <span className={styles.eventInfo}><strong>{item.event.title}</strong><span>{dateParts(item.event.startTime).long} · {item.event.venue}</span></span>
      <span className={styles.count}>{active} coverage {active === 1 ? "option" : "options"} on</span>
      <span className={`${styles.refreshChip} ${loading ? styles.refreshing : marketError ? styles.refreshError : remaining <= 5 ? styles.expiring : styles.current}`} role="status" aria-live={loading ? "polite" : "off"}>
        {loading ? "Refreshing prices…" : `Refresh in 0:${String(remaining).padStart(2, "0")}`}
      </span>
    </header>
    <div className={styles.coverages}>
      {item.coverages.map((coverage) => {
        const config = offer.coverages[coverage.id] ?? { enabled: false, refundPct: coverage.defaultRefundPct };
        const enabled = offer.published && config.enabled;
        return <section className={`${styles.coverage} ${enabled ? "" : styles.coverageOff}`} key={coverage.id}>
          <label className={styles.coverageHeading}>
            <strong>{coverage.name}</strong><span className={styles.refund}>{config.refundPct}% back</span>
            <span className={styles.coverageSwitch}>
              <span>{enabled ? "On" : "Off"}</span>
              <input type="checkbox" role="switch" aria-label={`${coverage.name} for ${item.event.title}`} checked={enabled} disabled={saving} onChange={(e) => update(coverage.id, e.target.checked)} />
              <span className={styles.switchTrack} />
            </span>
          </label>
          <MarketProviderOptions coverage={coverage} total={item.event.tiers[0].price} refundPct={config.refundPct}
            settings={config.providers} disabled={saving} inactive={!enabled} loading={loading}
            candidates={scan?.markets.find((m) => m.coverage.id === coverage.id)?.candidates}
            onChange={(provider, on) => update(coverage.id, undefined, provider, on)} />
        </section>;
      })}
    </div>
    <div className={styles.eventFooter}>
      <Link href={`/console/events/${item.event.id}`}>Manage event →</Link>
      <button type="button" disabled={saving || !item.coverages.length} onClick={() => setAll(active === 0)} className={styles.disableAll}>
        {saving ? "Saving…" : active > 0 ? "Disable all coverage" : "Enable coverage"}
      </button>
    </div>
    {marketError && <p role="alert" className={styles.error}>{marketError}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </article>;
}
export default function BusinessCoverageMarkets({ events }: { events: ManagedCoverageEvent[] }) {
  if (!events.length) return null;
  return <section className={styles.panel} aria-label="Event coverage markets">
    <div className={styles.heading}><h2>Coverage markets</h2></div>
    {events.map((item) => <EventMarkets key={item.event.id} item={item} />)}
  </section>;
}
