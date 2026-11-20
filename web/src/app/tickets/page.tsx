import Link from "next/link";
import Image from "next/image";
import CustomerHeader from "@/components/CustomerHeader";
import { EventMarks } from "@/components/TeamMarks";
import Icon from "@/components/TicketmasterIcon";
import { getCatalog } from "@/lib/service";
import { eventsWithCoverage } from "@/lib/offer-availability";
import { db } from "@/lib/store";
import { dateParts, usd0 } from "@/lib/format";
import styles from "@/components/SimpleCheckout.module.css";

export const dynamic = "force-dynamic";

export default async function CustomerEvents() {
  const { catalog, universe } = await getCatalog();
  const offers = db.offers();
  const events = eventsWithCoverage(catalog, offers, universe);
  return (
    <div className={styles.page}>
      <CustomerHeader />
      <main className={`${styles.main} ${styles.selectionMain}`} id="main-content">
        <div className={styles.pageHeading}><h1>Choose your next live moment</h1></div>
        <div className={styles.eventCards}>
          {events.map((event, index) => (
            <Link key={event.id} href={`/tickets/checkout?event=${encodeURIComponent(event.id)}`} className={styles.eventCard}>
              <div className={`${styles.eventArtwork} ${event.kind === "concert" ? styles.festivalArtwork : styles.nbaArtwork}`}>
                <Image
                  src={event.kind === "concert" ? "/events/concert.webp" : event.home?.abbr === "NYK" ? "/events/madison-square-garden.webp" : "/events/basketball.webp"}
                  alt=""
                  fill
                  sizes="(max-width: 680px) 100vw, 50vw"
                  priority={index < 2}
                  unoptimized
                  className={styles.eventPhoto}
                />
                {event.kind === "sports" && <div className={styles.artworkMarks}><EventMarks ev={event} /></div>}
              </div>
              <div className={styles.eventCardBody}>
                <h2>{event.title}</h2>
                <p className={styles.eventCardDetails}>{dateParts(event.startTime).long}<br />{event.venue}, {event.city}</p>
                <div className={styles.eventCardBottom}>
                  <span>From <strong>{usd0(Math.min(...event.tiers.map((tier) => tier.price)))}</strong><small> / ticket</small></span>
                  <span className={styles.chooseTickets}>Find tickets <Icon name="arrow-right" className={styles.icon} /></span>
                </div>
              </div>
            </Link>
          ))}
        </div>
        {!events.length && <div className={styles.emptyState}><Icon name="ticket-01" className={styles.icon} /><h2>More live moments are on the way.</h2><p>Check back soon for upcoming events.</p></div>}
      </main>
      <footer className={styles.footer}>Ticket protection, powered by Bluff.<span>Mobile tickets. Memorable nights.</span></footer>
    </div>
  );
}
