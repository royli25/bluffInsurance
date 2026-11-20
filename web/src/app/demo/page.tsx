import type { Metadata } from "next";
import Link from "next/link";
import TeamMarks from "@/components/TeamMarks";
import Icon from "@/components/TicketmasterIcon";
import { demoEvents, type DemoEventId } from "@/lib/checkout-demo";
import { usd0 } from "@/lib/format";
import styles from "@/components/SimpleCheckout.module.css";

export const metadata: Metadata = {
  title: "Choose your event · Bluff",
  description: "A weekend in the desert or a night at the Garden. Choose your event and tickets.",
};

export default function DemoEvents() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/demo" className={styles.brand}>Bluff<span>tickets</span></Link>
        <span className={styles.demoLabel}>Demo checkout</span>
        <Link href="/console" className={styles.backLink}>Back to console <Icon name="arrow-right" className={styles.icon} /></Link>
      </header>
      <main className={`${styles.main} ${styles.selectionMain}`}>
        <div className={styles.pageHeading}>
          <div><p className={styles.eyebrow}>GOOD TIMES AHEAD</p><h1>Choose your event</h1><p className={styles.selectionIntro}>A weekend in the desert or a night at the Garden.</p></div>
        </div>
        <div className={styles.eventCards}>
          {(Object.keys(demoEvents) as DemoEventId[]).map((id) => {
            const event = demoEvents[id];
            return (
              <Link key={id} href={`/demo/checkout?event=${id}`} className={styles.eventCard}>
                <div className={`${styles.eventArtwork} ${id === "festival" ? styles.festivalArtwork : styles.nbaArtwork}`}>
                  {id === "festival" ? <Icon name="ticket-01" className={styles.festivalIcon} /> : <TeamMarks league="NBA" participants={[{ abbreviation: "GSW", side: "away" }, { abbreviation: "NYK", side: "home" }]} large />}
                  <span>{id === "festival" ? "THREE DAYS. EVERY STAGE." : "ONE GAME. ALL THE ENERGY."}</span>
                </div>
                <div className={styles.eventCardBody}>
                  <p className={styles.eyebrow}>{event.category}</p>
                  <h2>{event.title}</h2>
                  <p className={styles.eventCardDetails}>{event.date}<br />{event.venue}</p>
                  <div className={styles.eventCardBottom}><span>From <strong>{usd0(event.tiers[0].price)}</strong><small> / {event.unit}</small></span><span className={styles.chooseTickets}>Choose tickets <Icon name="arrow-right" className={styles.icon} /></span></div>
                </div>
              </Link>
            );
          })}
        </div>
        <p className={styles.selectionNote}><Icon name="shield-tick" className={styles.icon} />Your plans, with a little more peace of mind. Choose protection at checkout.</p>
      </main>
      <footer className={styles.footer}>A good night out. A little more peace of mind.<span>Powered by Bluff</span></footer>
    </div>
  );
}
