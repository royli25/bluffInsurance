import Link from "next/link";
import { db } from "@/lib/store";
import { businessSummary } from "@/lib/business";
import { dashboardActivity, dashboardEvents } from "@/lib/dashboard";
import { dateParts, usd } from "@/lib/format";
import ManagedCoverageMarkets from "@/components/ManagedCoverageMarkets";
import AutoRefresh from "@/components/AutoRefresh";
import ContractLedger from "@/components/ContractLedger";
import DashboardCharts from "@/components/DashboardCharts";
import EventIdentity from "@/components/EventIdentity";
import Icon from "@/components/TicketmasterIcon";
import styles from "@/components/Dashboard.module.css";

export const dynamic = "force-dynamic";
export default function Dashboard() {
  const policies = db.policies();
  const summary = businessSummary(policies);
  const events = dashboardEvents(policies);
  const now = new Date();
  const statuses = [
    { label: "Active", count: summary.active, color: "#6ee7b7" },
    { label: "Pending", count: policies.filter((p) => p.status === "pending" || p.status === "settling").length, color: "#fcd34d" },
    { label: "Paid out", count: policies.filter((p) => p.status === "paid").length, color: "#8da8f5" },
    { label: "Completed", count: policies.filter((p) => p.status === "expired").length, color: "#737373" },
  ];
  return (
    <div className={styles.dashboard}>
      <AutoRefresh enabled />
      <header className={styles.header}>
        <h1>Dashboard</h1>
        <div className={styles.headerActions}>
          <time dateTime={now.toISOString()}>{now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" })}</time>
          <Link href="/console/events?add=1" className={styles.addEvent}><Icon name="plus" className={styles.icon} />Add event</Link>
        </div>
      </header>
      <section className={styles.metrics} aria-label="Business totals">
        <div className={styles.metric}>
          <div className={styles.metricHeading}><h2>Active contracts</h2><span className={styles.metricGlyph}><Icon name="shield-tick" className={styles.icon} /></span></div>
          <div data-metric="active" className={styles.metricValue}>{summary.active.toLocaleString()}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricHeading}><h2>Protected events</h2><span className={styles.metricGlyph}><Icon name="ticket-01" className={styles.icon} /></span></div>
          <div data-metric="events" className={styles.metricValue}>{summary.protectedEvents.toLocaleString()}</div>
        </div>
        <div className={`${styles.metric} ${styles.premiumMetric}`}>
          <div className={styles.metricHeading}><h2>Premiums collected</h2><span className={styles.metricGlyph}><Icon name="credit-card-01" className={styles.icon} /></span></div>
          <div data-metric="premiums" className={styles.metricValue}>{usd(summary.premiums)}</div>
        </div>
      </section>
      <ManagedCoverageMarkets />
      <DashboardCharts days={dashboardActivity(policies, now)} statuses={statuses} />
      {events.length > 0 && <section className={styles.eventSection}>
        <div className={styles.sectionHeading}><h2>Games & events</h2><Link href="/console/events" className={styles.viewAll}>View events<Icon name="arrow-right" className={styles.icon} /></Link></div>
        <div className={styles.eventList}>
          {events.slice(0, 3).map((event) => <Link key={event.id} href={`/console/contracts?event=${encodeURIComponent(event.id)}`} className={styles.eventCard}>
            <EventIdentity eventId={event.id} large />
            <div className={styles.eventInfo}><h3>{event.title}</h3><p>{dateParts(event.start).long} · {event.venue}</p></div>
            <div className={styles.eventFacts}>
              <div><span>Contracts</span><strong>{event.contracts}</strong></div>
              <div><span>Premiums</span><strong>{usd(event.premiums)}</strong></div>
              <div><span>Paid out</span><strong className={styles.paidValue}>{usd(event.paid)}</strong></div>
            </div>
          </Link>)}
        </div>
      </section>}
      <section className={styles.panel}>
        <div className={styles.recentHeading}><h2>Recent contracts</h2><Link href="/console/contracts" className={styles.viewAll}>View all<Icon name="arrow-right" className={styles.icon} /></Link></div>
        <ContractLedger policies={policies.slice(0, 8)} />
      </section>
      {summary.pending > 0 && <p className={styles.pending}>{summary.pending} awaiting confirmation. <Link href="/console/contracts">View contracts</Link></p>}
    </div>
  );
}
