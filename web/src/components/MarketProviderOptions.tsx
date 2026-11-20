"use client";
import ProviderLogo from "./ProviderLogo";
import type { Coverage } from "@/lib/coverage";
import { quote } from "@/lib/coverage";
import { priceBook, selectBest } from "@/lib/markets/pricing";
import { providerName, type MarketCandidate, type MarketProvider, type ProviderSettings } from "@/lib/markets/types";
import { usd } from "@/lib/format";
import styles from "./MarketProviderOptions.module.css";
export default function MarketProviderOptions({ coverage, candidates, settings = {}, total, refundPct, disabled, inactive, loading, onChange }: {
  coverage: Coverage; candidates?: MarketCandidate[]; settings?: ProviderSettings; total: number; refundPct: number;
  disabled?: boolean; inactive?: boolean; loading?: boolean; onChange: (p: MarketProvider, enabled: boolean) => void;
}) {
  const adjusted = candidates?.map((c) => {
    if (!c.book) return c.coverage && c.price ? { ...c, price: quote({ ...c.coverage, defaultRefundPct: refundPct }, total) } : c;
    const priced = priceBook({ ...coverage, defaultRefundPct: refundPct }, total, c.book, Date.parse(c.book.observedAt));
    return Date.now() - Date.parse(c.book.observedAt) > 35_000 ? { ...priced, state: "estimate" as const, reason: "Last checked price" } : priced;
  });
  const best = selectBest(adjusted ?? [], settings);
  const competitive = (adjusted ?? []).filter((c) => c.state === "live" && c.price && settings[c.provider] !== false).length > 1;
  const providers: MarketProvider[] = candidates?.map((c) => c.provider) ?? (coverage.id === "team-loses" && coverage.hedge.instrumentSymbol.includes("GEMI-NBA-") ? ["gemini", "kalshi"] : ["gemini"]);
  return <div className={styles.rows} aria-label={`${coverage.name} providers`}>
    {providers.map((provider) => {
      const candidate = adjusted?.find((c) => c.provider === provider);
      const selected = !disabled && !inactive && best?.provider === provider;
      return <label className={`${styles.row} ${disabled || inactive || settings[provider] === false ? styles.off : ""}`} key={provider}>
        <ProviderLogo provider={provider} dark />
        <span className={styles.status}>{loading ? "Checking…" : selected ? <span className={styles.selected}>{candidate?.state === "estimate" ? "Estimate" : competitive ? "Best price" : "Selected"}</span> : candidate?.state === "unavailable" ? candidate.reason ?? "Unavailable" : candidate?.state === "estimate" ? "Estimate" : candidate ? "Available" : "Not checked"}</span>
        <span className={styles.price}>{candidate?.price ? usd(candidate.price.premium) : "—"}</span>
        <span className={styles.toggle}>
          <input type="checkbox" role="switch" aria-label={`${providerName(provider)} for ${coverage.name}`} checked={settings[provider] !== false} disabled={disabled} onChange={(e) => onChange(provider, e.target.checked)} />
          <span />
        </span>
      </label>;
    })}
  </div>;
}
