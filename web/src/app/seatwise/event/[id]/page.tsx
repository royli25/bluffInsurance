/* eslint-disable @next/next/no-img-element -- Optimized local reference assets preserve original crops without a runtime image proxy. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { TicketmasterLogo } from "@/components/SeatwiseHeader";
import TicketPicker from "@/components/TicketPicker";
import EventInformation from "@/components/EventInformation";
import Icon from "@/components/TicketmasterIcon";
import { getEvent } from "@/lib/service";
import { dateParts } from "@/lib/format";
import { eventImage, ticketTitle } from "@/lib/ticketmaster";
export const dynamic = "force-dynamic";
export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { ev } = await getEvent(id);
  if (!ev) notFound();
  const d = dateParts(ev.startTime);
  return (
    <>
      <header className="tm-event-header">
        <div className="tm-event-topbar">
          <Link href="/seatwise" className="tm-event-home">
            <Icon name="menu-01" />
            <TicketmasterLogo />
          </Link>
          <Link href="/seatwise/account">
            <Icon name="user-01" /> My Account
          </Link>
        </div>
        <div className="tm-breadcrumb">
          <Link href="/seatwise">Home</Link>
          <span>/</span>
          <Link
            href={`/seatwise?category=${ev.kind === "sports" ? "sports" : "concerts"}`}
          >
            {ev.kind === "sports" ? "Sports" : "Concert Tickets"}
          </Link>
          <span>/</span>
          <span>{ev.home?.name ?? ev.title}</span>
        </div>
        <div className="tm-event-heading">
          <img src={eventImage(ev)} alt="" width="144" height="81" />
          <div>
            <div className="tm-event-heading-title">
              <h1>{ticketTitle(ev)}</h1>
              <EventInformation
                title={ticketTitle(ev)}
                date={d.long}
                venue={`${ev.venue}, ${ev.city}`}
              />
            </div>
            <p>{d.long}</p>
            <p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.venue + ", " + ev.city)}`}
              >
                {ev.venue}, {ev.city}
              </a>
            </p>
          </div>
        </div>
      </header>
      <div className="tm-event-important">
        <strong>Important Event Info:</strong> Please arrive early. All tickets
        are mobile entry.{" "}
        <span className="tm-important-protect">
          <Icon name="shield-tick" /> Bluff Protect available at checkout
        </span>
      </div>
      <TicketPicker ev={ev} />
    </>
  );
}
