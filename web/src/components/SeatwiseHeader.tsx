/* eslint-disable @next/next/no-img-element -- Optimized local reference assets preserve original crops without a runtime image proxy. */
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Icon from "./TicketmasterIcon";

export function TicketmasterLogo({ dark = false }: { dark?: boolean }) {
  // Official wordmark extracted from Ticketmaster's public theme.logoSvg.
  return (
    <img
      className="tm-logo"
      src={`/ticketmaster/logo-${dark ? "blue" : "white"}.svg`}
      alt="Ticketmaster"
      width="180"
      height="32"
    />
  );
}

export default function SeatwiseHeader() {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [dates, setDates] = useState("all");
  function search(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (location.trim()) params.set("city", location.trim());
    if (dates !== "all") params.set("dates", dates);
    if (!params.size) params.set("category", "sports");
    router.push(`/seatwise?${params.toString()}`);
  }
  return (
    <header className="tm-header">
      <div className="tm-utility">
        <div className="tm-utility-inner">
          <span className="tm-country">
            <span className="tm-us-flag" aria-hidden="true" /> US
          </span>
          <nav aria-label="Utility navigation">
            <a href="https://travel.ticketmaster.com/">
              <Icon name="building-02" /> Hotels
            </a>
            <a href="https://www.ticketmaster.com/sell">Sell</a>
            <a href="https://www.ticketmaster.com/giftcards">
              <Icon name="gift-01" /> Gift Cards
            </a>
            <a href="https://help.ticketmaster.com/">Help</a>
            <a href="https://www.ticketmaster.com/vip">VIP</a>
            <span className="tm-paypal-partner">
              PayPal{" "}
              <small>
                Preferred
                <br />
                Payments Partner
              </small>
            </span>
          </nav>
        </div>
      </div>
      <div className="tm-navigation">
        <button
          className="tm-mobile-menu tm-icon-button"
          aria-label={menu ? "Close navigation" : "Open navigation"}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          <Icon name={menu ? "x-close" : "menu-01"} />
        </button>
        <Link href="/seatwise" aria-label="Ticketmaster home">
          <TicketmasterLogo />
        </Link>
        <nav
          className={`tm-categories ${menu ? "is-open" : ""}`}
          aria-label="Main navigation"
        >
          {[
            ["Concerts", "concerts"],
            ["Sports", "sports"],
            ["Arts, Theater & Comedy", "arts"],
            ["Family", "family"],
            ["Cities", "cities"],
          ].map(([label, category]) => (
            <Link
              key={category}
              href={`/seatwise?category=${category}`}
              onClick={() => setMenu(false)}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Link className="tm-account-link" href="/seatwise/account">
          <Icon name="user-01" />
          <span>My Account</span>
        </Link>
      </div>
      <div className="tm-search-wrap">
        <form className="tm-search" onSubmit={search} role="search">
          <label className="tm-search-location">
            <Icon name="marker-pin-01" />
            <span>
              <span className="tm-input-label">Location</span>
              <input
                aria-label="City or Zip Code"
                placeholder="City or Zip Code"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </span>
          </label>
          <label className="tm-search-dates">
            <Icon name="calendar" />
            <span>
              <span className="tm-input-label">Dates</span>
              <select
                aria-label="Dates"
                value={dates}
                onChange={(e) => setDates(e.target.value)}
              >
                <option value="all">All Dates</option>
                <option value="weekend">This Weekend</option>
                <option value="week">This Week</option>
              </select>
            </span>
            <Icon name="chevron-down" />
          </label>
          <label className="tm-search-query">
            <Icon name="search-lg" />
            <span>
              <span className="tm-input-label">Search</span>
              <input
                aria-label="Artist, Event or Venue"
                placeholder="Artist, Event or Venue"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </span>
          </label>
          <button className="tm-search-submit" type="submit">
            <span>Search</span>
            <Icon name="search-lg" />
          </button>
        </form>
      </div>
    </header>
  );
}
