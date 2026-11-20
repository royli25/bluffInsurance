import content from "./ticketmaster-content.json";
import type { TicketEvent } from "./catalog";
import teamLogos from "./team-logos.json";
export { content };
export function eventImage(ev: Pick<TicketEvent, "home" | "kind" | "league">) {
  const match = ev.home && content.sports.find((e) => e.name === ev.home!.name);
  if (ev.home?.abbr === "NYK") return "/ticketmaster/knicks.jpg";
  if (match) return match.image;
  const logo =
    ev.home &&
    (teamLogos as Record<string, string>)[`${ev.league}:${ev.home.abbr}`];
  if (logo) return logo;
  // Local concert names are demo acts; use generic event artwork, not a real artist's photo.
  if (ev.kind === "concert") return content.featured[2].image;
  return content.guides[ev.league === "NHL" ? 1 : 0].image;
}
export function ticketTitle(ev: TicketEvent) {
  return ev.home && ev.away ? `${ev.home.name} vs. ${ev.away.name}` : ev.title;
}
