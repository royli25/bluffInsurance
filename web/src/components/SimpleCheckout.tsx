"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EventMarks } from "@/components/TeamMarks";
import Icon from "@/components/TicketmasterIcon";
import { usd, usd0, dateParts } from "@/lib/format";
import { quote, type Coverage } from "@/lib/coverage";
import type { TicketEvent } from "@/lib/catalog";
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
  const [protectionId, setProtectionId] = useState<string>(
    options[0]?.id ?? "none",
  );
  const [confirmed, setConfirmed] = useState(false);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("Jordan Rivera");
  const [email, setEmail] = useState("jordan@example.com");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const confirmation = useRef<HTMLHeadingElement>(null);
  const tier = event.tiers[tierIndex];
  const protection = options.find((c) => c.id === protectionId);
  const subtotal = tier.price * quantity;
  const q = protection
    ? quote(protection, subtotal, protection.defaultRefundPct)
    : null;
  const total = subtotal + (q?.premium ?? 0);
  useEffect(() => {
    if (confirmed) confirmation.current?.focus();
  }, [confirmed]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (protection) {
        const r = await fetch("/api/policies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: event.id,
            coverageId: protection.id,
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
        if (!r.ok)
          throw new Error(
            data.error ?? "Could not complete the demo checkout.",
          );
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
      <header className={styles.header}>
        <Link href="/console" className={styles.brand}>
          bluff<span>checkout</span>
        </Link>
        <span className={styles.demoLabel}>Demo · no charge</span>
        <Link href={`/console/events/${event.id}`} className={styles.backLink}>
          Back to event <Icon name="arrow-right" className={styles.icon} />
        </Link>
      </header>
      <main className={styles.main}>
        <div className={styles.pageHeading}>
          <div>
            <h1>{confirmed ? "Order complete" : "Checkout"}</h1>
          </div>
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
                    <span>Contract</span>
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
                ? "Demo contract saved."
                : "No protection contract was created."}{" "}
              No charge.
            </p>
            <div className={styles.confirmationActions}>
              {policy && (
                <Link
                  href={`/console/contracts/${policy.id}`}
                  className={styles.primary}
                >
                  View contract & resolve outcome{" "}
                  <Icon name="arrow-right" className={styles.icon} />
                </Link>
              )}
              <Link href="/console" className={styles.secondary}>
                Back to dashboard
              </Link>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => {
                  setConfirmed(false);
                  setPolicy(null);
                  setRequestId(crypto.randomUUID());
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
                  <span className={styles.step}>1</span>Choose your tickets
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
                  <span className={styles.step}>2</span>Choose your protection{" "}
                  <span className={styles.optional}>Optional</span>
                </h2>
                <div className={styles.protectionOptions}>
                  {options.map((option) => {
                    const amount = quote(
                      option,
                      subtotal,
                      option.defaultRefundPct,
                    );
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
                          <span>
                            If {option.trigger}.{" "}
                            {option.hedgeType === "partial"
                              ? "Partially hedged; reserves cover the remaining risk."
                              : ""}
                          </span>
                        </span>
                        <span className={styles.protectionPrice}>
                          +{usd(amount.premium)}
                          <small>for the order</small>
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
                  <span>{q ? usd(q.premium) : "Not added"}</span>
                </div>
                {q && (
                  <div className={styles.payout}>
                    <span>Potential money back</span>
                    <span>{usd(q.payout)}</span>
                  </div>
                )}
                <div className={styles.total}>
                  <strong>Total</strong>
                  <strong>{usd(total)}</strong>
                </div>
              </div>
              <div className={styles.payment}>
                <Icon name="credit-card-01" className={styles.icon} />
                <div>
                  <strong>Demo Visa ending in 4242</strong>
                  <span>No payment is processed</span>
                </div>
              </div>
              {error && (
                <p role="alert" className={styles.error}>
                  {error}
                </p>
              )}
              <button className={styles.primary} disabled={busy} type="submit">
                {busy ? "Creating your contract…" : "Complete demo purchase"}
                <Icon name="arrow-right" className={styles.icon} />
              </button>
              <p className={styles.noCharge}>
                <Icon name="lock-01" className={styles.icon} />
                Demo only. You won’t be charged.
              </p>
            </aside>
          </form>
        )}
      </main>
      <footer className={styles.footer}>
        Ticket protection, powered by Bluff.<span>Hackathon demo</span>
      </footer>
    </div>
  );
}
