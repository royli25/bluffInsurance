"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TicketEvent } from "@/lib/catalog";
import { usd } from "@/lib/format";
import Icon from "./TicketmasterIcon";
import VenueMap from "./VenueMap";

export default function TicketPicker({ ev }: { ev: TicketEvent }) {
  const [tier, setTier] = useState(ev.tiers[1]?.id ?? ev.tiers[0].id);
  const [qty, setQty] = useState(2);
  const [sort, setSort] = useState("price");
  const [filters, setFilters] = useState(false);
  const [maxPrice, setMaxPrice] = useState(
    Math.max(...ev.tiers.map((t) => t.price)),
  );
  const router = useRouter();
  const idx = ev.tiers.findIndex((t) => t.id === tier);
  const selected = ev.tiers[idx];
  const tickets = ev.tiers
    .filter((t) => t.price <= maxPrice)
    .sort((a, b) => (sort === "price" ? a.price - b.price : b.price - a.price));
  return (
    <div className="tm-ticket-picker">
      <div className="tm-seat-area">
        <VenueMap
          ev={ev}
          selected={idx}
          onSelect={(i) => setTier(ev.tiers[i].id)}
        />
        <p className="tm-map-disclaimer">
          Map is representative of the venue. Select a section to explore
          tickets.
        </p>
      </div>
      <aside className="tm-ticket-sidebar">
        <div className="tm-ticket-filters">
          <div>
            <label className="tm-quantity-select">
              <select
                aria-label="Ticket quantity"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option value={n} key={n}>
                    {n} Ticket{n !== 1 ? "s" : ""}
                  </option>
                ))}
              </select>
              <Icon name="chevron-down" />
            </label>
            <button
              className="tm-pill"
              onClick={() => setFilters(!filters)}
              aria-expanded={filters}
            >
              <Icon name="sliders-04" /> Filters
            </button>
          </div>
          <div className="tm-price-range">
            <span>{usd(Math.min(...ev.tiers.map((t) => t.price)))}</span>
            <input
              aria-label="Maximum ticket price"
              type="range"
              min={Math.min(...ev.tiers.map((t) => t.price))}
              max={Math.max(...ev.tiers.map((t) => t.price))}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
            />
            <span>{usd(maxPrice)}</span>
          </div>
          {filters && (
            <div className="tm-filter-popover">
              <strong>Ticket Types</strong>
              <label>
                <input type="checkbox" checked readOnly /> Standard Tickets
              </label>
              <p>Available inventory for this event.</p>
              <button className="tm-button" onClick={() => setFilters(false)}>
                Apply Filters
              </button>
            </div>
          )}
        </div>
        <div
          className="tm-ticket-sort"
          role="tablist"
          aria-label="Sort tickets"
        >
          <button
            role="tab"
            aria-selected={sort === "price"}
            className={sort === "price" ? "is-active" : ""}
            onClick={() => setSort("price")}
          >
            Lowest Price
          </button>
          <button
            role="tab"
            aria-selected={sort === "seats"}
            className={sort === "seats" ? "is-active" : ""}
            onClick={() => setSort("seats")}
          >
            Best Seats
          </button>
        </div>
        <div className="tm-all-in">
          We’re All In: Prices include fees (before taxes).
        </div>
        <div className="tm-ticket-options">
          {tickets.map((t) => (
            <button
              className={`tm-ticket-option ${tier === t.id ? "is-selected" : ""}`}
              onClick={() => setTier(t.id)}
              key={t.id}
            >
              <div className="tm-ticket-mini-map">
                <VenueMap ev={ev} selected={ev.tiers.indexOf(t)} mini />
              </div>
              <div>
                <span className="tm-featured-badge">
                  {tier === t.id ? "Selected" : "Available"}
                </span>
                <h3>{t.section}</h3>
                <span>{t.name}</span>
                <p>Standard Ticket</p>
              </div>
              <div className="tm-ticket-option-price">
                {usd(t.price)}
                <small>each</small>
                <Icon name={tier === t.id ? "check-circle" : "chevron-right"} />
              </div>
            </button>
          ))}
        </div>
        <div className="tm-ticket-selection">
          <div>
            <strong>{qty} Tickets</strong>
            <span>{selected.section}</span>
            <b>{usd(selected.price * qty)}</b>
          </div>
          <button
            className="tm-button tm-next-button"
            onClick={() =>
              router.push(`/seatwise/checkout/${ev.id}?tier=${tier}&qty=${qty}`)
            }
          >
            Next <Icon name="chevron-right" />
          </button>
        </div>
      </aside>
    </div>
  );
}
