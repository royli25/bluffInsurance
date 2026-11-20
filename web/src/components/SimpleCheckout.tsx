"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import TeamMarks from "@/components/TeamMarks";
import Icon from "@/components/TicketmasterIcon";
import { usd, usd0 } from "@/lib/format";
import { demoEvents, type DemoEventId } from "@/lib/checkout-demo";
import styles from "./SimpleCheckout.module.css";

export default function SimpleCheckout({ initialEvent: eventId }: { initialEvent: DemoEventId }) {
  const [tierIndex, setTierIndex] = useState(0);
  const [quantity, setQuantity] = useState(2);
  const [protectionId, setProtectionId] = useState("none");
  const [confirmed, setConfirmed] = useState(false);
  const confirmation = useRef<HTMLHeadingElement>(null);
  const event = demoEvents[eventId];
  const protection = event.protections.find((option) => option.id === protectionId);
  const tier = event.tiers[tierIndex];
  const unitLabel = quantity === 1 ? event.unit : event.unit === "pass" ? "passes" : "tickets";
  const subtotal = tier.price * quantity;
  const premium = Math.round(subtotal * (protection?.rate ?? 0) * 100) / 100;
  const payout = Math.round(subtotal * (protection?.refund ?? 0) * 100) / 100;
  const total = subtotal + premium;

  useEffect(() => {
    if (confirmed) confirmation.current?.focus();
  }, [confirmed]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/demo" className={styles.brand}>Bluff<span>tickets</span></Link>
        <span className={styles.demoLabel}>Demo checkout</span>
        <Link href="/console" className={styles.backLink}>Back to console <Icon name="arrow-right" className={styles.icon} /></Link>
      </header>

      <main className={styles.main}>
        <div className={styles.pageHeading}>
          <div><p className={styles.eyebrow}>GOOD TIMES AHEAD</p><h1>Checkout</h1></div>
          <Link href="/demo" className={styles.changeEvent}><Icon name="chevron-left" className={styles.icon} />Change event</Link>
        </div>

        <section className={styles.eventHeading} aria-label="Selected event">
          {eventId === "nba" ? (
            <TeamMarks league="NBA" participants={[{ abbreviation: "GSW", side: "away" }, { abbreviation: "NYK", side: "home" }]} large />
          ) : <div className={styles.festivalMark}><Icon name="ticket-01" className={styles.festivalIcon} /></div>}
          <div><p className={styles.muted}>{event.category}</p><h2>{event.title}</h2><p className={styles.eventMeta}><span>{event.date}</span><span>{event.venue}</span></p></div>
        </section>

        {confirmed ? (
          <section className={styles.confirmation}>
            <div className={styles.successMark}><Icon name="check" className={styles.icon} /></div>
            <p className={styles.eyebrow}>DEMO ORDER CONFIRMED</p>
            <h2 ref={confirmation} tabIndex={-1}>You’re all set.</h2>
            <p className={styles.muted}>{`${quantity} ${tier.name.toLowerCase()} ${unitLabel} for ${event.title}.`}</p>
            <div className={styles.confirmationReceipt}>
              <div><span>Total</span><strong>{usd(total)}</strong></div>
              <div><span>Protection</span><strong>{protection?.name ?? "Not added"}</strong></div>
              {protection && <p>{protection.trigger} Get {usd(payout)} back on this order.</p>}
            </div>
            <p className={styles.finePrint}>This was a demo. No payment was taken and no tickets were issued.</p>
            <div className={styles.confirmationActions}>
              <button type="button" className={styles.primary} onClick={() => setConfirmed(false)}>Back to checkout</button>
              <Link href="/demo" className={styles.secondary}>Choose another event <Icon name="arrow-right" className={styles.icon} /></Link>
            </div>
          </section>
        ) : (
          <form className={styles.checkoutGrid} onSubmit={(e) => { e.preventDefault(); setConfirmed(true); }}>
            <div className={styles.checkoutMain}>
              <section className={styles.card}>
                <fieldset className={styles.ticketFieldset}>
                  <legend className={styles.sectionTitle}><span className={styles.step}>1</span>Choose your {eventId === "festival" ? "pass" : "seats"}</legend>
                  <div className={styles.tiers}>
                    {event.tiers.map((option, index) => (
                      <label key={option.name} className={`${styles.tier} ${tierIndex === index ? styles.selectedTier : ""}`}>
                        <input type="radio" name="tier" value={index} checked={tierIndex === index} onChange={() => setTierIndex(index)} />
                        <span className={styles.tierCopy}><strong>{option.name}</strong><span>{option.detail}</span></span>
                        <span className={styles.tierPrice}>{usd0(option.price)}<small> / {event.unit}</small></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className={styles.quantityRow}>
                  <label htmlFor="ticket-quantity">How many?</label>
                  <div className={styles.quantity}>
                    <button type="button" aria-label="Remove one ticket" disabled={quantity === 1} onClick={() => setQuantity(quantity - 1)}><Icon name="minus" className={styles.icon} /></button>
                    <output id="ticket-quantity" aria-live="polite">{quantity}</output>
                    <button type="button" aria-label="Add one ticket" disabled={quantity === 6} onClick={() => setQuantity(quantity + 1)}><Icon name="plus" className={styles.icon} /></button>
                  </div>
                </div>
              </section>

              <section className={styles.card}>
                <fieldset className={styles.ticketFieldset}>
                  <legend className={styles.sectionTitle}><span className={styles.step}>2</span>Choose your protection <span className={styles.optional}>Optional</span></legend>
                  <div className={styles.protectionOptions}>
                    {event.protections.map((option) => (
                      <label key={option.id} className={`${styles.protection} ${protectionId === option.id ? styles.protectionSelected : ""}`}>
                        <input type="radio" name="protection" value={option.id} checked={protectionId === option.id} onChange={() => setProtectionId(option.id)} />
                        <span className={styles.protectionCopy}><strong>{option.name} <span className={styles.refundBadge}>{Math.round(option.refund * 100)}% back</span></strong><span>{option.trigger}</span></span>
                        <span className={styles.protectionPrice}>+{usd(Math.round(subtotal * option.rate * 100) / 100)}<small>for the order</small></span>
                      </label>
                    ))}
                    <label className={`${styles.protection} ${protectionId === "none" ? styles.noProtectionSelected : ""}`}>
                      <input type="radio" name="protection" value="none" checked={protectionId === "none"} onChange={() => setProtectionId("none")} />
                      <span className={styles.protectionCopy}><strong>No protection</strong><span>Just the tickets.</span></span>
                      <span className={styles.protectionPrice}>$0</span>
                    </label>
                  </div>
                </fieldset>
                <p className={styles.protectionDetail}><Icon name="shield-tick" className={styles.icon} />Bluff Protect. Automatic payouts. No claim forms.</p>
              </section>
            </div>

            <aside className={`${styles.card} ${styles.summary}`} aria-label="Order summary">
              <h2>Your order</h2>
              <p className={styles.orderEvent}>{event.title}</p>
              <p className={styles.muted}>{`${tier.name} · ${quantity} ${unitLabel}`}</p>
              <div className={styles.priceLines} aria-live="polite" aria-atomic="true">
                <div><span>{quantity} × {usd(tier.price)}</span><span>{usd(subtotal)}</span></div>
                <div><span>{protection?.name ?? "Protection"}</span><span>{protection ? usd(premium) : "Not added"}</span></div>
                {protection && <div className={styles.payout}><span>Potential money back</span><span>{usd(payout)}</span></div>}
                <div className={styles.total}><strong>Total</strong><strong>{usd(total)}</strong></div>
              </div>
              <p className={styles.finePrint}>All ticket fees included. Sample event and pricing.</p>
              <div className={styles.payment}><Icon name="credit-card-01" className={styles.icon} /><div><strong>Demo Visa ending in 4242</strong><span>Mobile ticket delivery</span></div></div>
              <button className={styles.primary} type="submit">{`Get ${quantity} ${unitLabel}`} <Icon name="arrow-right" className={styles.icon} /></button>
              <p className={styles.noCharge}><Icon name="lock-01" className={styles.icon} />Demo only. You won’t be charged.</p>
            </aside>
          </form>
        )}
      </main>
      <footer className={styles.footer}>A good night out. A little more peace of mind.<span>Powered by Bluff</span></footer>
    </div>
  );
}
