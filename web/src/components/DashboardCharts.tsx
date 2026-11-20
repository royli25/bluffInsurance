"use client";

import { useState } from "react";
import { usd, usd0 } from "@/lib/format";
import styles from "./Dashboard.module.css";

type Day = { date: string; premiums: number; contracts: number };
type Status = { label: string; count: number; color: string };
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default function DashboardCharts({ days, statuses }: { days: Day[]; statuses: Status[] }) {
  const [range, setRange] = useState(7);
  const [focused, setFocused] = useState<number | null>(null);
  const visible = days.slice(-range);
  const total = visible.reduce((sum, day) => sum + day.premiums, 0);
  const max = Math.max(...visible.map((day) => day.premiums), 1);
  const selected = focused === null ? null : visible[focused];
  const contracts = statuses.reduce((sum, status) => sum + status.count, 0);
  let offset = 0;
  const segments = statuses.filter((status) => status.count).map((status) => {
    const start = offset;
    offset += status.count / contracts * 100;
    return `${status.color} ${start}% ${offset}%`;
  });
  return (
    <div className={styles.charts}>
      <section className={`${styles.panel} ${styles.activity}`} aria-label="Premium activity">
        <div className={styles.panelHeading}>
          <h2>Premium activity</h2>
          <div className={styles.range} role="group" aria-label="Activity date range">
            {[7, 30].map((value) => <button key={value} type="button" aria-pressed={range === value} onClick={() => { setRange(value); setFocused(null); }}>{value} days</button>)}
          </div>
        </div>
        <div className={styles.chartReadout} aria-live="polite">
          <strong>{usd(selected ? selected.premiums : total)}</strong>
          <span>{selected ? `${dateLabel(selected.date)} · ${selected.contracts} contract${selected.contracts === 1 ? "" : "s"}` : `${dateLabel(visible[0].date)} – ${dateLabel(visible[visible.length - 1].date)}`}</span>
        </div>
        <div className={styles.plot}>
          <div className={styles.yAxis} aria-hidden="true"><span>{usd0(max)}</span><span>{usd0(max / 2)}</span><span>$0</span></div>
          <div className={styles.plotArea}>
            <div className={styles.gridLines} aria-hidden="true"><i /><i /><i /></div>
            <div className={styles.bars} style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }} onMouseLeave={() => setFocused(null)}>
              {visible.map((day, index) => (
                <button key={day.date} type="button" className={`${styles.barTarget} ${focused === index ? styles.focusedBar : ""}`} aria-label={`${dateLabel(day.date)}: ${usd(day.premiums)} in premiums, ${day.contracts} contracts`} onFocus={() => setFocused(index)} onBlur={() => setFocused(null)} onMouseEnter={() => setFocused(index)} onClick={() => setFocused(focused === index ? null : index)}>
                  <span className={day.premiums ? styles.barFill : styles.barEmpty} style={{ height: day.premiums ? `${Math.max(1, day.premiums / max * 100)}%` : "2px" }} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.xAxis} aria-hidden="true"><span>{dateLabel(visible[0].date)}</span><span>{dateLabel(visible[Math.floor((visible.length - 1) / 2)].date)}</span><span>{dateLabel(visible[visible.length - 1].date)}</span></div>
      </section>
      <section className={`${styles.panel} ${styles.statusPanel}`}>
        <div className={styles.panelHeading}><h2>Contract status</h2><span>{contracts} total</span></div>
        <div className={styles.statusBody}>
          <div className={styles.donut} role="img" aria-label={contracts ? statuses.filter((status) => status.count).map((status) => `${status.count} ${status.label.toLowerCase()}`).join(", ") : "No contracts yet"} style={{ background: contracts ? `conic-gradient(${segments.join(", ")})` : "#303030" }}>
            <div><strong>{contracts}</strong><span>contracts</span></div>
          </div>
          <ul className={styles.legend}>
            {statuses.map((status) => <li key={status.label}><span className={styles.legendLabel}><i style={{ background: status.color }} />{status.label}</span><strong>{status.count}</strong></li>)}
          </ul>
        </div>
      </section>
    </div>
  );
}
