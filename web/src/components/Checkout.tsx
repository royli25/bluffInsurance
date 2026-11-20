"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TicketEvent, TicketTier } from "@/lib/catalog";
import type { Coverage, Quote } from "@/lib/coverage";
import { dateParts, usd } from "@/lib/format";
import { ticketTitle } from "@/lib/ticketmaster";
import { TicketmasterLogo } from "./SeatwiseHeader";
import Icon from "./TicketmasterIcon";
import VenueMap from "./VenueMap";

type Row = { coverage: Coverage; quote: Quote };
export default function Checkout({
  ev,
  tier,
  qty,
  initialRows,
}: {
  ev: TicketEvent;
  tier: TicketTier;
  qty: number;
  initialRows: Row[];
}) {
  const router = useRouter();
  const [rooting, setRooting] = useState<"home" | "away">("home");
  const [rows, setRows] = useState<Row[] | null>(initialRows);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [quoteErr, setQuoteErr] = useState("");
  const [retry, setRetry] = useState(0);
  const [secs, setSecs] = useState(479);
  const [agreed, setAgreed] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(true);
  const [promo, setPromo] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const subtotal = tier.price * qty;
  useEffect(() => {
    const timer = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (rooting === "home" && retry === 0) {
      setRows(initialRows);
      setQuoteErr("");
      setPick(initialRows.length ? "" : "none");
      return;
    }
    const controller = new AbortController();
    setRows(null);
    setQuoteErr("");
    setPick("");
    fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: ev.id, rooting, tierId: tier.id, qty }),
      signal: controller.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok)
          throw new Error(d.error ?? "Could not load protection options");
        return d;
      })
      .then((d) => {
        setRows(d.coverages ?? []);
        if (!d.coverages?.length) setPick("none");
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setQuoteErr("We couldn’t load protection prices. Please try again.");
      });
    return () => controller.abort();
  }, [ev.id, rooting, tier.id, qty, retry, initialRows]);
  const chosen = rows?.find((r) => r.coverage.id === pick);
  const total = subtotal + (chosen?.quote.premium ?? 0);
  async function placeOrder() {
    setErr("");
    if (!rows || !pick) {
      setErr("Please choose a protection option, or select no protection.");
      document
        .getElementById("bluff-protection")
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    if (!agreed) {
      setErr("Please agree to the Terms of Use and Standard Purchase Policy.");
      return;
    }
    if (secs === 0) {
      setErr(
        "Your checkout session has expired. Please select your tickets again.",
      );
      return;
    }
    setBusy(true);
    try {
      if (!chosen) {
        router.push("/seatwise/account?order=ok");
        return;
      }
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: ev.id,
          coverageId: chosen.coverage.id,
          rooting,
          tierId: tier.id,
          qty,
          holderName: "Jordan Rivera",
          holderEmail: "jordan@example.com",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to place your order.");
      router.push(`/seatwise/account?new=${data.policy.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="tm-checkout-page">
      <header className="tm-checkout-header">
        <Link href="/seatwise" aria-label="Ticketmaster home">
          <TicketmasterLogo />
        </Link>
        <div className="tm-checkout-title">
          <h1>Checkout</h1>
          <div
            className={`tm-checkout-countdown ${secs < 60 ? "is-urgent" : ""}`}
          >
            <span>
              Time Left
              <strong>
                {Math.floor(secs / 60)
                  .toString()
                  .padStart(2, "0")}
                :{String(secs % 60).padStart(2, "0")}
              </strong>
            </span>
            <span className="tm-countdown-dial" aria-hidden="true">
              <i />
            </span>
          </div>
        </div>
      </header>
      <main className="tm-checkout-grid">
        <div className="tm-checkout-main">
          <section className="tm-checkout-card tm-delivery-card">
            <h2>Delivery</h2>
            <div className="tm-delivery-method">
              <strong>Mobile</strong>
              <b>FREE</b>
            </div>
            <p>
              To access your tickets for entry, you’ll need the Ticketmaster App
              or add your tickets to your mobile wallet.
            </p>
          </section>
          <section className="tm-checkout-card tm-payment-card">
            <button
              className="tm-checkout-card-heading"
              onClick={() => setPaymentOpen(!paymentOpen)}
              aria-expanded={paymentOpen}
            >
              <h2>Payment</h2>
              <Icon name="chevron-down" />
            </button>
            {paymentOpen && (
              <>
                <div className="tm-payment-partner">
                  <strong>PayPal</strong>
                  <small>
                    Preferred
                    <br />
                    Payments Partner
                  </small>
                </div>
                <h3>Use Credit / Debit Card</h3>
                <label className="tm-saved-card">
                  <input
                    aria-label="Use saved Visa ending in 4242"
                    type="radio"
                    checked
                    readOnly
                  />
                  <span className="tm-visa">VISA</span>
                  <span>
                    <strong>Visa ending in 4242</strong>
                    <small>Jordan Rivera · Exp. 12/28</small>
                  </span>
                  <Icon name="check-circle" />
                </label>
                <p className="tm-saved-card-note">
                  <Icon name="lock-01" /> Saved payment method
                </p>
                <div className="tm-payment-divider" />
                <h3>Or Pay With</h3>
                <div className="tm-wallets">
                  {["PayPal", "Pay Later", "Klarna", "venmo"].map(
                    (wallet, i) => (
                      <button
                        className={`tm-wallet tm-wallet-${i}`}
                        key={wallet}
                        onClick={() =>
                          setPaymentNotice(
                            `${wallet} is not connected. Choose another payment method.`,
                          )
                        }
                      >
                        {wallet}
                      </button>
                    ),
                  )}
                </div>
                {paymentNotice && (
                  <p role="status" className="tm-payment-notice">
                    {paymentNotice}
                  </p>
                )}
                <p className="tm-payment-legal">
                  By using a digital wallet and continuing past this page, you
                  agree to the current{" "}
                  <a href="https://help.ticketmaster.com/hc/en-us/articles/10468830739345-Terms-of-Use">
                    Terms of Use
                  </a>{" "}
                  and{" "}
                  <a href="https://help.ticketmaster.com/hc/en-us/articles/10465798887953-Purchase-Policy">
                    Standard Purchase Policy.
                  </a>
                </p>
                <div className="tm-payment-divider" />
                <button
                  className="tm-promo-toggle"
                  onClick={() => setPromo(!promo)}
                  aria-expanded={promo}
                >
                  <Icon name={promo ? "minus" : "plus"} /> Add Credits / Promo
                  Codes / Gift Cards
                </button>
                {promo && (
                  <form
                    className="tm-promo-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setPaymentNotice(
                        promoCode
                          ? "This code is not valid for this order."
                          : "Enter a promo code to continue.",
                      );
                    }}
                  >
                    <input
                      aria-label="Promo code"
                      placeholder="Enter code"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                    />
                    <button className="tm-outline-button">Apply</button>
                  </form>
                )}
              </>
            )}
          </section>
          <section
            className="tm-checkout-card tm-protect-card"
            id="bluff-protection"
          >
            <div className="tm-checkout-card-heading">
              <h2>Ticket Protection</h2>
              <span
                className={
                  pick ? "tm-selection-complete" : "tm-selection-required"
                }
              >
                {pick ? (
                  <>
                    <Icon name="check" /> Selected
                  </>
                ) : (
                  "Selection Required"
                )}
              </span>
            </div>
            <div className="tm-bluff-brand">
              <Icon name="shield-tick" />
              <span>
                Bluff <strong>Protect</strong>
              </span>
            </div>
            <p>You’re going for the experience. Protect it.</p>
            <p className="tm-protect-intro">
              Your team loses, the star sits, or the weather turns? Choose a
              cover and get money back automatically if it happens.
            </p>
            <div className="tm-protect-benefits">
              <p>
                <strong>A clear payout. No claims to file.</strong> See exactly
                what’s covered before you buy.
              </p>
              <div>
                <span>
                  <i>
                    <Icon name="shield-tick" />
                  </i>
                  Choose your coverage
                </span>
                <span>
                  <i>
                    <Icon name="clock" />
                  </i>
                  Results checked automatically
                </span>
                <span>
                  <i>
                    <Icon name="credit-card-01" />
                  </i>
                  Money back if it happens
                </span>
              </div>
            </div>
            {ev.kind === "sports" && ev.home && ev.away && (
              <fieldset className="tm-rooting">
                <legend>Who are you rooting for?</legend>
                <div>
                  {(["home", "away"] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setRooting(side)}
                      aria-pressed={rooting === side}
                      className={rooting === side ? "is-active" : ""}
                    >
                      {(side === "home" ? ev.home : ev.away)!.name}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {!rows && !quoteErr && (
              <div className="tm-quote-loading" role="status">
                Loading your protection options…
              </div>
            )}
            {quoteErr && (
              <div className="tm-quote-error" role="alert">
                {quoteErr}
                <button
                  className="tm-text-link"
                  onClick={() => setRetry(retry + 1)}
                >
                  Try again
                </button>
              </div>
            )}
            <div className="tm-protection-choices">
              {rows?.map(({ coverage: c, quote: q }) => (
                <label
                  key={c.id}
                  className={`tm-protection-choice ${pick === c.id ? "is-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="protection"
                    value={c.id}
                    checked={pick === c.id}
                    onChange={() => setPick(c.id)}
                  />
                  <span className="tm-protection-choice-content">
                    <strong>{c.name}</strong>
                    <span>
                      If {c.trigger}, get <b>{usd(q.payout)} back.</b>
                    </span>
                    <small>{c.blurb}</small>
                  </span>
                  <span className="tm-protection-choice-price">
                    <strong>{usd(q.premium)}</strong>
                    <small>total</small>
                  </span>
                </label>
              ))}
              <label
                className={`tm-protection-choice tm-no-protection ${pick === "none" ? "is-selected" : ""}`}
              >
                <input
                  type="radio"
                  name="protection"
                  value="none"
                  checked={pick === "none"}
                  onChange={() => setPick("none")}
                />
                <span>
                  <strong>No, do not protect my ticket purchase.</strong>
                  <span>
                    I understand this order won’t include Bluff protection.
                  </span>
                </span>
              </label>
            </div>
            <p className="tm-protection-disclosure">
              Protection is provided by Bluff. Payouts apply only to the
              specific outcome and amount selected above. This is separate from
              ticket cancellation or non-attendance insurance.{" "}
              {rows?.some((r) => r.coverage.hedgeType === "partial") &&
                "Star Sits uses a partial hedge, with remaining exposure backed by the Bluff reserve."}
            </p>
          </section>
        </div>
        <aside className="tm-checkout-sidebar">
          <section className="tm-checkout-card tm-total-card">
            <button
              className="tm-total-heading"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
            >
              <h2 className="tm-section-title">Total</h2>
              <strong>{usd(total)}</strong>
              <Icon name="chevron-down" />
            </button>
            {expanded && (
              <div className="tm-total-breakdown">
                <h3>Tickets</h3>
                <div>
                  <span>
                    Standard Ticket: {usd(tier.price)} × {qty}
                  </span>
                  <strong>{usd(subtotal)}</strong>
                </div>
                <p>Includes required fees.</p>
                {chosen && (
                  <>
                    <h3>Ticket Protection</h3>
                    <div>
                      <span>Bluff {chosen.coverage.name}</span>
                      <strong>{usd(chosen.quote.premium)}</strong>
                    </div>
                  </>
                )}
              </div>
            )}
            <Link className="tm-cancel-order" href={`/seatwise/event/${ev.id}`}>
              Cancel Order
            </Link>
            <p className="tm-all-sales">*All Sales Final - No Refunds</p>
            {chosen && (
              <p className="tm-refund-exception">
                Your selected Bluff payout applies if the covered outcome
                happens.
              </p>
            )}
            <label className="tm-terms">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span>
                I have read and agree to the current{" "}
                <a
                  href="https://help.ticketmaster.com/hc/en-us/articles/10468830739345-Terms-of-Use"
                  target="_blank"
                  rel="noreferrer"
                >
                  Terms of Use
                </a>{" "}
                and{" "}
                <a
                  href="https://help.ticketmaster.com/hc/en-us/articles/10465798887953-Purchase-Policy"
                  target="_blank"
                  rel="noreferrer"
                >
                  Standard Purchase Policy
                </a>
                , including the arbitration agreement and class action waiver.
              </span>
            </label>
            {err && (
              <div className="tm-checkout-error" role="alert">
                {err}
              </div>
            )}
            <button
              className="tm-place-order"
              disabled={busy || secs === 0}
              onClick={placeOrder}
            >
              {busy ? "Placing your order…" : "Place Order"}
            </button>
            <small>*Exemptions may apply, see our Terms of Use.</small>
          </section>
          <section className="tm-checkout-card tm-checkout-event">
            <VenueMap
              ev={ev}
              selected={Math.max(
                0,
                ev.tiers.findIndex((t) => t.id === tier.id),
              )}
              mini
            />
            <h2>{ticketTitle(ev)}</h2>
            <p>{dateParts(ev.startTime).long}</p>
            <p>
              {ev.venue} - {ev.city}
            </p>
            <p>
              {qty} Tickets · {tier.section}
            </p>
            <div className="tm-ticket-information">
              <Icon name="info-circle" />
              <span>
                Ticket Information<small>{tier.name} · Mobile Entry</small>
              </span>
            </div>
          </section>
        </aside>
      </main>
      <footer className="tm-checkout-footer">
        <Icon name="lock-01" /> Protected by Bluff
        <Link href="/seatwise/account">My Tickets</Link>
        <Link href="/console">Bluff Console</Link>
      </footer>
    </div>
  );
}
