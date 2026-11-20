"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EventMarks } from "@/components/TeamMarks";
import Icon from "@/components/TicketmasterIcon";
import ProviderLogo from "@/components/ProviderLogo";
import CustomerHeader from "@/components/CustomerHeader";
import { usd, usd0, dateParts } from "@/lib/format";
import type { Coverage } from "@/lib/coverage";
import type { TicketEvent } from "@/lib/catalog";
import type { CheckoutQuote } from "@/lib/checkout-quote";
import type { Policy } from "@/lib/store";
import styles from "./SimpleCheckout.module.css";
export default function SimpleCheckout({
  event,
  options,
}: {
  event: TicketEvent;
  options: Coverage[];
}) {
  const [tierIndex, setTierIndex] = useState(0);
  const [quantity, setQuantity] = useState(2);
  const [protectionId, setProtectionId] = useState<string>("none");
  const [confirmed, setConfirmed] = useState(false);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("Jordan Rivera");
  const [email, setEmail] = useState("jordan@example.com");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const confirmation = useRef<HTMLHeadingElement>(null);
  const tier = event.tiers[tierIndex];
  const [prices, setPrices] = useState<CheckoutQuote | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [priceError, setPriceError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(0);
  const lastAutoRefresh = useRef<string | null>(null);
  const matchingPrices = prices?.tierId === tier.id && prices.qty === quantity ? prices : null;
  const remaining = matchingPrices ? Math.max(0, Math.ceil((Date.parse(matchingPrices.expiresAt) - now) / 1000)) : 0;
  const ready = !!matchingPrices && !loadingPrices && !priceError;
  const currentOptions = matchingPrices?.options.map((o) => o.coverage) ?? options;
  const protection = currentOptions.find((c) => c.id === protectionId);
  const subtotal = tier.price * quantity;
  const q = ready ? matchingPrices.options.find((o) => o.coverage.id === protectionId)?.price : undefined;
  const canPurchase = protectionId === "none" || (ready && remaining > 0 && !!q);
  const total = subtotal + (q?.premium ?? 0);
  useEffect(() => {
    if (confirmed) return;
    if (!options.length) {
      setLoadingPrices(false);
      setPriceError("");
      return;
    }
    const controller = new AbortController();
    setLoadingPrices(true);
    setPriceError("");
    fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: event.id, tierId: tier.id, qty: quantity, rooting: "home" }),
      signal: controller.signal,
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Could not fetch protection prices.");
      if (controller.signal.aborted) return;
      setNow(Date.now());
      setPrices(data.quote);
      setProtectionId((id) => id === "none" || data.quote.options.some((o: { coverage: Coverage }) => o.coverage.id === id) ? id : data.quote.options[0]?.coverage.id ?? "none");
    }).catch((e) => {
      if (!controller.signal.aborted) setPriceError(e.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoadingPrices(false);
    });
    return () => controller.abort();
  }, [event.id, tier.id, quantity, refresh, confirmed, options.length]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!matchingPrices || !ready || remaining > 0 || busy || confirmed || lastAutoRefresh.current === matchingPrices.id) return;
    // One refresh per expired quote. Failed requests show a retry instead of looping.
    lastAutoRefresh.current = matchingPrices.id;
    setRefresh((value) => value + 1);
  }, [matchingPrices, ready, remaining, busy, confirmed]);
  useEffect(() => {
    if (confirmed) confirmation.current?.focus();
  }, [confirmed]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !canPurchase) return;
    setBusy(true);
    setError("");
    try {
      if (protectionId !== "none" && q && matchingPrices) {
        const r = await fetch("/api/policies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: event.id,
            coverageId: protectionId,
            quoteId: matchingPrices.id,
            rooting: "home",
            tierId: tier.id,
            qty: quantity,
            holderName: name.trim(),
            holderEmail: email.trim(),
            demo: true,
            requestId,
          }),
        });
        const data = await r.json();
        if (!r.ok) {
          if (/quote|refresh|protection changed/i.test(data.error ?? "")) setPriceError(data.error);
          throw new Error(data.error ?? "Could not confirm your order.");
        }
        setPolicy(data.policy);
      }
      setConfirmed(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.page}>
      <CustomerHeader checkout />
      <main className={styles.main}>
        <div className={styles.pageHeading}>
          <div>
            <h1>{confirmed ? "Order complete" : "Checkout"}</h1>
          </div>
          <Link href="/tickets" className={styles.changeEvent}><Icon name="chevron-left" className={styles.icon} />Change event</Link>
        </div>
        <section className={styles.eventHeading} aria-label="Selected event">
          {event.kind === "sports" ? (
            <EventMarks ev={event} large />
          ) : (
            <div className={styles.festivalMark}>
              <Icon name="ticket-01" className={styles.festivalIcon} />
            </div>
          )}
          <div>
            <h2>{event.title}</h2>
            <p className={styles.eventMeta}>
              <span>{dateParts(event.startTime).long}</span>
              <span>{event.venue}</span>
            </p>
          </div>
        </section>
        {confirmed ? (
          <section className={styles.confirmation}>
            <div className={styles.successMark}>
              <Icon name="check" className={styles.icon} />
            </div>
            <h2 ref={confirmation} tabIndex={-1}>
              {policy ? "You’re protected." : "You’re all set."}
            </h2>
            <p className={styles.muted}>
              {quantity} × {tier.name} for {event.title}.
            </p>
            <div className={styles.confirmationReceipt}>
              <div>
                <span>Order total</span>
                <strong>
                  {usd(policy ? policy.ticketTotal + policy.premium : subtotal)}
                </strong>
              </div>
              <div>
                <span>Protection</span>
                <strong>{policy?.coverageName ?? "Not added"}</strong>
              </div>
              {policy && (
                <>
                  <div>
                    <span>Protection reference</span>
                    <strong className={styles.contractId}>
                      {policy.id.replace("pol_demo_", "").toUpperCase()}
                    </strong>
                  </div>
                  <p>
                    If {policy.trigger}, get {usd(policy.payout)} back.
                  </p>
                </>
              )}
            </div>
            <p className={styles.finePrint}>
              {policy
                ? "Your protection is saved."
                : "Tickets selected without protection."}{" "}
            </p>
            <div className={styles.confirmationActions}>
              <Link href="/tickets" className={styles.primary}>
                Browse more events <Icon name="arrow-right" className={styles.icon} />
              </Link>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => {
                  setConfirmed(false);
                  setPolicy(null);
                  setRequestId(crypto.randomUUID());
                  setPrices(null);
                }}
              >
                Try another purchase
              </button>
            </div>
          </section>
        ) : (
          <form className={styles.checkoutGrid} onSubmit={submit}>
            <fieldset
              disabled={busy}
              className={styles.checkoutMain}
              style={{ border: 0, padding: 0, margin: 0 }}
            >
              <section className={styles.card}>
                <h2 className={styles.sectionTitle}>
                  <span className={styles.step}>1</span>Tickets
                </h2>
                <div className={styles.tiers}>
                  {event.tiers.map((option, index) => (
                    <label
                      key={option.id}
                      className={`${styles.tier} ${tierIndex === index ? styles.selectedTier : ""}`}
                    >
                      <input
                        type="radio"
                        name="tier"
                        value={option.id}
                        checked={tierIndex === index}
                        onChange={() => setTierIndex(index)}
                      />
                      <span className={styles.tierCopy}>
                        <strong>{option.name}</strong>
                        <span>{option.section}</span>
                      </span>
                      <span className={styles.tierPrice}>
                        {usd0(option.price)}
                        <small> / ticket</small>
                      </span>
                    </label>
                  ))}
                </div>
                <div className={styles.quantityRow}>
                  <span>How many?</span>
                  <div className={styles.quantity}>
                    <button
                      type="button"
                      aria-label="Remove one ticket"
                      disabled={quantity === 1}
                      onClick={() => setQuantity(quantity - 1)}
                    >
                      <Icon name="minus" className={styles.icon} />
                    </button>
                    <output aria-live="polite">{quantity}</output>
                    <button
                      type="button"
                      aria-label="Add one ticket"
                      disabled={quantity === 6}
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      <Icon name="plus" className={styles.icon} />
                    </button>
                  </div>
                </div>
              </section>
              <section className={styles.card}>
                <h2 className={styles.sectionTitle}>
                  <span className={styles.step}>2</span>Protection{" "}
                  {options.length > 0 && <span
                    className={`${styles.quoteChip} ${priceError ? styles.quoteUnavailable : loadingPrices || !matchingPrices || remaining === 0 ? styles.quoteUpdating : remaining <= 5 ? styles.quoteExpiring : styles.quoteCurrent}`}
                    role="status"
                    aria-live={loadingPrices || priceError ? "polite" : "off"}
                    title={prices?.source === "estimate" ? "Estimated pricing. Prices refresh automatically when the countdown ends." : "Prices refresh automatically when the countdown ends."}
                  >
                    {priceError ? "Prices unavailable" : loadingPrices || !matchingPrices || remaining === 0 ? "Refreshing prices…" : `${prices?.source === "estimate" ? "Estimate · " : "Refresh in "}0:${String(remaining).padStart(2, "0")}`}
                  </span>}
                </h2>
                <div className={styles.protectionOptions} aria-busy={loadingPrices}>
                  {currentOptions.map((option) => {
                    const amount = ready ? matchingPrices.options.find((o) => o.coverage.id === option.id)?.price : undefined;
                    return (
                      <label
                        key={option.id}
                        className={`${styles.protection} ${protectionId === option.id ? styles.protectionSelected : ""}`}
                      >
                        <input
                          type="radio"
                          name="protection"
                          value={option.id}
                          checked={protectionId === option.id}
                          onChange={() => setProtectionId(option.id)}
                        />
                        <span className={styles.protectionCopy}>
                          <strong>
                            {option.name}
                            <span className={styles.refundBadge}>
                              {option.defaultRefundPct}% back
                            </span>
                          </strong>
                          <span>If {option.trigger}.</span>
                        </span>
                        <span className={styles.protectionPurchase}>
                          <span className={styles.protectionProvider}>
                            <span>Powered by</span>
                            <span className={option.hedge.provider === "kalshi" ? styles.kalshiChip : styles.geminiChip}><ProviderLogo provider={option.hedge.provider ?? "gemini"} dark={option.hedge.provider !== "kalshi"} /></span>
                          </span>
                          <span className={styles.protectionPrice}>
                            {amount ? `+${usd(amount.premium)}` : <span className={styles.priceSkeleton} aria-label="Fetching price" />}
                            <small>for the order</small>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                  <label
                    className={`${styles.protection} ${protectionId === "none" ? styles.noProtectionSelected : ""}`}
                  >
                    <input
                      type="radio"
                      name="protection"
                      value="none"
                      checked={protectionId === "none"}
                      onChange={() => setProtectionId("none")}
                    />
                    <span className={styles.protectionCopy}>
                      <strong>No protection</strong>
                      <span>Just the tickets.</span>
                    </span>
                    <span className={styles.protectionPrice}>$0</span>
                  </label>
                </div>
                {priceError && <p role="alert" className={styles.error}>{priceError}</p>}
                {!!options.length && !loadingPrices && priceError && <button type="button" className={styles.refreshPrices} onClick={() => setRefresh((r) => r + 1)}>Retry prices</button>}
                {!currentOptions.length && <p role="status" className={styles.finePrint}>Protection isn’t available for this event.</p>}
              </section>
              <section className={styles.card}>
                <h2 className={styles.sectionTitle}>
                  <span className={styles.step}>3</span>Your details
                </h2>
                <div className={styles.customerFields}>
                  <label>
                    Name
                    <input
                      required
                      maxLength={100}
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label>
                    Email
                    <input
                      required
                      type="email"
                      maxLength={200}
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                </div>
              </section>
            </fieldset>
            <aside
              className={`${styles.card} ${styles.summary}`}
              aria-label="Order summary"
            >
              <h2>Your order</h2>
              <p className={styles.orderEvent}>{event.title}</p>
              <p className={styles.muted}>
                {tier.name} · {quantity} tickets
              </p>
              <div
                className={styles.priceLines}
                aria-live="polite"
                aria-atomic="true"
              >
                <div>
                  <span>
                    {quantity} × {usd(tier.price)}
                  </span>
                  <span>{usd(subtotal)}</span>
                </div>
                <div>
                  <span>{protection?.name ?? "Protection"}</span>
                  <span>{protectionId === "none" ? "Not added" : q ? usd(q.premium) : "—"}</span>
                </div>
                {q && (
                  <div className={styles.payout}>
                    <span>Potential money back</span>
                    <span>{usd(q.payout)}</span>
                  </div>
                )}
                <div className={styles.total}>
                  <strong>Total</strong>
                  <strong>{protectionId === "none" || q ? usd(total) : "—"}</strong>
                </div>
              </div>
              {error && (
                <p role="alert" className={styles.error}>
                  {error}
                </p>
              )}
              <button className={styles.primary} disabled={busy || !canPurchase} type="submit">
                {busy ? "Confirming your order…" : "Confirm order"}
                <Icon name="arrow-right" className={styles.icon} />
              </button>
            </aside>
          </form>
        )}
      </main>
      <footer className={styles.footer}>
        <span className={styles.footerBrand}>bluff</span>
        <div className={styles.providerRow}><span>Built with</span><ProviderLogo provider="gemini" /><ProviderLogo provider="arc" /><ProviderLogo provider="quicknode" /></div>
      </footer>
    </div>
  );
}
