/* eslint-disable @next/next/no-img-element -- Optimized local reference assets preserve original crops without a runtime image proxy. */
import Link from "next/link";
import SeatwiseHeader from "@/components/SeatwiseHeader";
import TicketmasterFooter from "@/components/TicketmasterFooter";
import Icon from "@/components/TicketmasterIcon";
import { db } from "@/lib/store";
import { dateParts, usd } from "@/lib/format";
import AutoRefresh from "@/components/AutoRefresh";
import { streamConfig } from "@/lib/quicknode/config";
import { policyStatusText } from "@/lib/policy-status";
import { formatUnits } from "viem";
export const dynamic = "force-dynamic";
export default async function Account({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; order?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const policies = db.policies();
  const fresh = policies.find((p) => p.id === sp.new);
  const past = sp.tab === "past";
  const shown = policies.filter((p) =>
    past
      ? new Date(p.eventStart).getTime() < Date.now()
      : new Date(p.eventStart).getTime() >= Date.now(),
  );
  return (
    <>
      <AutoRefresh
        enabled={
          streamConfig().enabled &&
          policies.some(
            (p) =>
              p.arc.mode === "live" &&
              ["pending", "active", "settling"].includes(p.status),
          )
        }
      />
      <SeatwiseHeader />
      <nav className="tm-account-nav" aria-label="Account navigation">
        <div>
          <Link href="/seatwise/account" className="is-active">
            My Events
          </Link>
          <Link href="/seatwise?category=sports">Find Events</Link>
          <Link href="/tickets">Browse events</Link>
          <a href="https://help.ticketmaster.com/">Help</a>
        </div>
        <span>Hi, Jordan</span>
      </nav>
      <main className="tm-my-events">
        {(fresh || sp.order) && (
          <section className="tm-order-confirmation">
            <Icon name="check-circle" />
            <div>
              <h1>
                {fresh?.status === "pending"
                  ? "Order received · Confirmation pending"
                  : "You’re going! Order confirmed."}
              </h1>
              <p>
                {fresh
                  ? `${fresh.coverageName}: ${policyStatusText(fresh)}. Covered payout: ${usd(fresh.payout)} if ${fresh.trigger}.`
                  : "Your order is confirmed. Enjoy the event!"}
              </p>
            </div>
          </section>
        )}
        <div className="tm-my-events-heading">
          <h1>My Events</h1>
          <span>Jordan Rivera</span>
        </div>
        <div className="tm-account-tabs">
          <Link href="/seatwise/account" className={!past ? "is-active" : ""}>
            Upcoming (
            {
              policies.filter(
                (p) => new Date(p.eventStart).getTime() >= Date.now(),
              ).length
            }
            )
          </Link>
          <Link
            href="/seatwise/account?tab=past"
            className={past ? "is-active" : ""}
          >
            Past Events
          </Link>
        </div>
        {!shown.length && (
          <section className="tm-account-empty">
            <Icon name="ticket-01" />
            <h2>{past ? "No past events" : "You have no upcoming events"}</h2>
            <p>Your next unforgettable experience is waiting.</p>
            <Link href="/seatwise?category=sports" className="tm-button">
              Find Your Next Event
            </Link>
          </section>
        )}
        <div className="tm-account-event-list">
          {shown.map((p) => {
            const d = dateParts(p.eventStart);
            return (
              <article className="tm-account-ticket" key={p.id}>
                <div className="tm-account-ticket-art">
                  <img
                    src={
                      p.eventId.includes("nyk")
                        ? "/ticketmaster/knicks.jpg"
                        : "/ticketmaster/guides-0.jpg"
                    }
                    alt=""
                  />
                  <div className="tm-account-ticket-date">
                    <span>{d.mon}</span>
                    <strong>{d.day}</strong>
                  </div>
                </div>
                <div className="tm-account-ticket-main">
                  <div className="tm-account-ticket-info">
                    <p>{d.long}</p>
                    <h2>{p.eventTitle}</h2>
                    <p>{p.venue}</p>
                    <span>
                      {p.qty} Tickets · {p.tierName}
                    </span>
                  </div>
                  <div className="tm-account-ticket-actions">
                    <span>Order #{p.id.replace("pol_", "").toUpperCase()}</span>
                    <Link
                      className="tm-button"
                      href={`/seatwise/event/${p.eventId}`}
                    >
                      View Event Details
                    </Link>
                  </div>
                </div>
                <div
                  className={`tm-account-protection tm-account-protection-${p.status}`}
                >
                  <div>
                    <Icon name="shield-tick" />
                    <span>
                      Bluff Protect <strong>{p.coverageName}</strong>
                    </span>
                  </div>
                  <p>
                    If {p.trigger}, get <strong>{usd(p.payout)} back.</strong>
                  </p>
                  <span className="tm-policy-status">
                    <Icon
                      name={
                        p.status === "paid"
                          ? "check-circle"
                          : ["active", "pending", "settling"].includes(p.status)
                            ? "clock"
                            : "info-circle"
                      }
                    />
                    {policyStatusText(p)}
                  </span>
                  {p.status === "paid" && (
                    <small>
                      {p.arc.mode === "simulated"
                        ? "Refund recorded "
                        : "Arc payout confirmed "}
                      {p.settledAt &&
                        new Date(p.settledAt).toLocaleString("en-US", {
                          timeZone: "America/Chicago",
                        })}{" "}
                      {p.chain?.settlement &&
                        ` · ${formatUnits(BigInt(String(p.chain.settlement.args.paid)), 6)} USDC`}
                    </small>
                  )}
                  {p.chain && (
                    <small>
                      Verified from Arc events via QuickNode Streams.
                    </small>
                  )}
                  {(p.purchaseError || p.settlementError) && (
                    <small>{p.purchaseError || p.settlementError}</small>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </main>
      <TicketmasterFooter />
    </>
  );
}
