/* eslint-disable @next/next/no-img-element -- Optimized local reference assets preserve original crops without a runtime image proxy. */
import Link from "next/link";
import type { TicketEvent } from "@/lib/catalog";
import { dateParts, usd0 } from "@/lib/format";
import { eventImage, ticketTitle } from "@/lib/ticketmaster";
import Icon from "./TicketmasterIcon";
export default function EventRow({ ev }: { ev: TicketEvent }) {
  const d = dateParts(ev.startTime);
  const from = Math.min(...ev.tiers.map((t) => t.price));
  return (
    <article className="tm-event-row">
      <div className="tm-event-date">
        <span>{d.mon}</span>
        <strong>{d.day}</strong>
      </div>
      <div className="tm-event-thumbnail">
        <img src={eventImage(ev)} alt="" loading="lazy" />
      </div>
      <div className="tm-event-description">
        <div className="tm-event-time">
          {d.dow} · {d.time}
        </div>
        <div className="tm-event-venue">
          {ev.city} · {ev.venue}
        </div>
        <Link href={`/seatwise/event/${ev.id}`} className="tm-event-name">
          {ticketTitle(ev)}
        </Link>
        <span className="tm-protection-tag">
          <Icon name="shield-tick" /> Bluff Protect available
        </span>
      </div>
      <div className="tm-event-price">
        From <strong>{usd0(from)}</strong>
        <span>Includes fees</span>
      </div>
      <Link
        href={`/seatwise/event/${ev.id}`}
        className="tm-button tm-find-tickets"
      >
        Find Tickets <Icon name="chevron-right" />
      </Link>
    </article>
  );
}
