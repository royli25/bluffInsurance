/* eslint-disable @next/next/no-img-element -- Optimized local reference assets preserve original crops without a runtime image proxy. */
import Link from "next/link";
import SeatwiseHeader from "@/components/SeatwiseHeader";
import TicketmasterFooter from "@/components/TicketmasterFooter";
import EventRow from "@/components/EventRow";
import Icon from "@/components/TicketmasterIcon";
import { getCatalog } from "@/lib/service";
import { content, eventImage } from "@/lib/ticketmaster";
export const dynamic = "force-dynamic";

type Search = {
  q?: string;
  category?: string;
  league?: string;
  city?: string;
  dates?: string;
};
export default async function Seatwise({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const { catalog } = await getCatalog();
  const isSearch = !!(sp.q || sp.category || sp.city || sp.dates);
  let filtered = catalog.filter((ev) => {
    const text =
      `${ev.title} ${ev.venue} ${ev.city} ${ev.league}`.toLowerCase();
    return (
      (!sp.q || text.includes(sp.q.toLowerCase())) &&
      (!sp.city || ev.city.toLowerCase().includes(sp.city.toLowerCase())) &&
      (!sp.league || ev.league === sp.league) &&
      (sp.category !== "sports" || ev.kind === "sports") &&
      (sp.category !== "concerts" || ev.kind === "concert") &&
      !["arts", "family"].includes(sp.category ?? "")
    );
  });
  if (sp.dates) {
    const now = Date.now();
    filtered = filtered.filter(
      (e) =>
        new Date(e.startTime).getTime() <
        now + (sp.dates === "week" ? 7 : 3) * 86400_000,
    );
  }
  const hero = catalog.find((e) => e.home?.abbr === "NYK") ?? catalog[0];
  const highlights = [
    catalog.find((e) => e.home?.abbr === "GSW"),
    catalog.find((e) => e.league === "NFL"),
    catalog.find((e) => e.league === "NHL"),
    catalog.find((e) => e.home?.abbr === "MIA"),
  ].filter((e): e is NonNullable<typeof e> => !!e);
  const title = sp.q
    ? `Search results for “${sp.q}”`
    : sp.category === "concerts"
      ? "Concert Tickets"
      : sp.category === "arts"
        ? "Arts, Theater & Comedy Tickets"
        : sp.category === "family"
          ? "Family Tickets"
          : sp.category === "cities"
            ? "Events by City"
            : "Sports Tickets";
  return (
    <>
      <SeatwiseHeader />
      <main id="main-content">
        {isSearch ? (
          <>
            <div className="tm-discover-heading">
              <div className="tm-container">
                <div className="tm-breadcrumb">
                  <Link href="/seatwise">Home</Link>
                  <span>/</span>
                  <span>{sp.q ? "Search" : title}</span>
                </div>
                <h1>{title}</h1>
                <p>
                  <Icon name="marker-pin-01" />{" "}
                  {sp.city || "All of United States"}
                </p>
              </div>
            </div>
            <div className="tm-container tm-results">
              <div className="tm-sport-filters">
                {[
                  ["All Events", ""],
                  ["Basketball", "NBA"],
                  ["Football", "NFL"],
                  ["Hockey", "NHL"],
                  ["College Football", "NCAAF"],
                  ["Soccer", "MLS"],
                ].map(([label, league]) => (
                  <Link
                    key={label}
                    className={(sp.league ?? "") === league ? "is-active" : ""}
                    href={`/seatwise?category=sports${league ? `&league=${league}` : ""}`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
              <div className="tm-results-heading">
                <h2>
                  {sp.q ? "Events" : "All Events"}{" "}
                  <span>{filtered.length} Results</span>
                </h2>
                <span>
                  All Dates <Icon name="chevron-down" />
                </span>
              </div>
              <div className="tm-event-list">
                {filtered.slice(0, 40).map((ev) => (
                  <EventRow key={ev.id} ev={ev} />
                ))}
                {!filtered.length && (
                  <div className="tm-empty">
                    <Icon name="search-lg" />
                    <h2>No matching events</h2>
                    <p>Try another artist, team, venue or city.</p>
                    <Link
                      className="tm-button"
                      href="/seatwise?category=sports"
                    >
                      Browse all sports
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <section className="tm-highlights" aria-label="Highlights">
              {hero && (
                <Link className="tm-hero" href={`/seatwise/event/${hero.id}`}>
                  <div className="tm-hero-art">
                    <img
                      src={
                        hero.home?.abbr === "NYK"
                          ? "/ticketmaster/knicks-banner.jpg"
                          : eventImage(hero)
                      }
                      alt={hero.home?.name ?? hero.title}
                      fetchPriority="high"
                    />
                  </div>
                  <div className="tm-hero-caption">
                    <div>
                      <span>{hero.league} TICKETS</span>
                      <h1>{hero.home?.name ?? hero.title}</h1>
                      <p>Be there for every moment.</p>
                    </div>
                    <span className="tm-button">
                      Find Tickets <Icon name="chevron-right" />
                    </span>
                  </div>
                </Link>
              )}
              <div className="tm-spotlights">
                {highlights.map((ev) => (
                  <Link
                    className="tm-spotlight"
                    href={`/seatwise/event/${ev.id}`}
                    key={ev.id}
                  >
                    <div>
                      <img src={eventImage(ev)} alt="" />
                    </div>
                    <span>{ev.league}</span>
                    <h2>{ev.home?.name ?? ev.title}</h2>
                  </Link>
                ))}
              </div>
            </section>
            <div className="tm-home-columns">
              <div className="tm-home-main">
                <h2 className="tm-section-title">Popular Near You</h2>
                {(
                  [
                    ["Concerts", "concerts"],
                    ["Sports", "sports"],
                    ["Arts, Theater & Comedy", "arts"],
                    ["Family", "family"],
                  ] as const
                ).map(([label, key]) => (
                  <section className="tm-popular-section" key={key}>
                    <div className="tm-section-heading">
                      <h3>{label}</h3>
                      <Link
                        className="tm-outline-button"
                        href={`/seatwise?category=${key}`}
                      >
                        See All
                      </Link>
                    </div>
                    <div className="tm-card-grid">
                      {content[key].slice(0, 3).map((item) => (
                        <Link
                          key={item.name}
                          href={`/seatwise?${key === "sports" ? `q=${encodeURIComponent(item.name)}` : `category=${key}`}`}
                          className="tm-editorial-card"
                        >
                          <div>
                            <img
                              src={item.image}
                              alt={item.name}
                              loading="lazy"
                            />
                          </div>
                          <span>{item.genre}</span>
                          <h4>{item.name}</h4>
                        </Link>
                      ))}
                    </div>
                  </section>
                ))}
                <section className="tm-guides">
                  <h2 className="tm-section-title">Entertainment Guides</h2>
                  <div className="tm-guide-grid">
                    {content.guides.map((g, i) => (
                      <Link
                        key={g.title}
                        href={`/seatwise?category=sports${i === 1 ? "&league=NHL" : i === 0 ? "&league=NBA" : ""}`}
                        className="tm-guide-card"
                      >
                        <img src={g.image} alt="" loading="lazy" />
                        <h3>{g.title}</h3>
                        <p>{g.text}</p>
                      </Link>
                    ))}
                  </div>
                </section>
                <section className="tm-upcoming">
                  <div className="tm-section-heading">
                    <h2 className="tm-section-title">Your Next Live Moment</h2>
                    <Link
                      href="/seatwise?category=sports"
                      className="tm-text-link"
                    >
                      See All <Icon name="chevron-right" />
                    </Link>
                  </div>
                  {catalog
                    .filter((e) => e.kind === "sports")
                    .slice(0, 4)
                    .map((ev) => (
                      <EventRow key={ev.id} ev={ev} />
                    ))}
                </section>
                <section className="tm-discover-more">
                  <h2 className="tm-section-title">Discover More</h2>
                  <div className="tm-card-grid">
                    {content.discover.slice(0, 6).map((item) => (
                      <a
                        key={item.title}
                        href="https://blog.ticketmaster.com/"
                        className="tm-editorial-card"
                      >
                        <img src={item.image} alt="" loading="lazy" />
                        <span>{item.tagline}</span>
                        <h4>{item.title}</h4>
                        <p>{item.text}</p>
                        <b className="tm-discover-link">Discover More</b>
                      </a>
                    ))}
                  </div>
                </section>
              </div>
              <aside className="tm-home-aside">
                <div className="tm-ad-space">Advertisement</div>
                <h2 className="tm-section-title">Featured</h2>
                {content.featured.map((item) => (
                  <a
                    href="https://www.ticketmaster.com/"
                    key={item.text}
                    className="tm-featured-card"
                  >
                    <img src={item.image} alt="" loading="lazy" />
                    <h3>{item.text}</h3>
                  </a>
                ))}
                <div className="tm-bluff-aside">
                  <Icon name="shield-tick" />
                  <h3>A little more peace of mind.</h3>
                  <p>
                    Add Bluff Protect at checkout. If the night doesn’t go your
                    way, get part of your ticket back automatically.
                  </p>
                  <Link href="/seatwise?category=sports">
                    Explore protected events <Icon name="arrow-right" />
                  </Link>
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
      <TicketmasterFooter />
    </>
  );
}
