import type { GEvent, MarketUniverse } from "./gemini/types";

/**
 * Builds the ticketing storefront's event list directly from Gemini markets:
 * every upcoming game with a moneyline market becomes a ticketed event, so any
 * protection we sell is guaranteed to have a hedge market behind it.
 * Concerts are outdoor shows in cities that have Gemini daily-high weather markets.
 */

export type EventKind = "sports" | "concert";

export interface Team {
  name: string;
  abbr: string;
  side: "home" | "away";
  color: string;
}

export interface TicketTier {
  id: string;
  name: string;
  section: string;
  price: number;
}

export interface TicketEvent {
  id: string;
  kind: EventKind;
  title: string;
  subtitle: string;
  league: string;
  venue: string;
  city: string;
  startTime: string;
  home?: Team;
  away?: Team;
  /** Gemini ticker root shared by this game's markets, e.g. NBA-2611220100-LAC-DAL */
  marketRoot?: string;
  /** Gemini weather event ticker for concerts */
  weatherTicker?: string;
  weatherTitle?: string;
  tiers: TicketTier[];
  heroFrom: string;
  heroTo: string;
  custom?: boolean;
}

const ARENAS: Record<string, Record<string, string>> = {
  NBA: {
    ATL: "State Farm Arena", BOS: "TD Garden", BKN: "Barclays Center", CHA: "Spectrum Center", CHI: "United Center",
    CLE: "Rocket Arena", DAL: "American Airlines Center", DEN: "Ball Arena", DET: "Little Caesars Arena",
    GSW: "Chase Center", HOU: "Toyota Center", IND: "Gainbridge Fieldhouse", LAC: "Intuit Dome", LAL: "Crypto.com Arena",
    MEM: "FedExForum", MIA: "Kaseya Center", MIL: "Fiserv Forum", MIN: "Target Center", NOP: "Smoothie King Center",
    NYK: "Madison Square Garden", OKC: "Paycom Center", ORL: "Kia Center", PHI: "Wells Fargo Center", PHX: "PHX Arena",
    POR: "Moda Center", SAC: "Golden 1 Center", SAS: "Frost Bank Center", TOR: "Scotiabank Arena", UTA: "Delta Center",
    WAS: "Capital One Arena",
  },
  NFL: {
    LAR: "SoFi Stadium", GB: "Lambeau Field", DET: "Ford Field", CHI: "Soldier Field", DAL: "AT&T Stadium",
    PHI: "Lincoln Financial Field", KC: "Arrowhead Stadium", SF: "Levi's Stadium", BAL: "M&T Bank Stadium",
    CAR: "Bank of America Stadium", PIT: "Acrisure Stadium", DEN: "Empower Field", LV: "Allegiant Stadium",
    NYJ: "MetLife Stadium", LAC: "SoFi Stadium", MIN: "U.S. Bank Stadium", WAS: "Northwest Stadium",
    CIN: "Paycor Stadium", TB: "Raymond James Stadium", ARI: "State Farm Stadium",
  },
};

/** Marquee player per team for "star sits out" cover (demo data). */
export const STARS: Record<string, Record<string, string>> = {
  NBA: {
    GSW: "Stephen Curry", LAL: "LeBron James", DAL: "Luka Dončić", BOS: "Jayson Tatum", DEN: "Nikola Jokić",
    MIL: "Giannis Antetokounmpo", OKC: "Shai Gilgeous-Alexander", MIN: "Anthony Edwards", NYK: "Jalen Brunson",
    PHI: "Joel Embiid", MEM: "Ja Morant", SAS: "Victor Wembanyama", LAC: "Kawhi Leonard", PHX: "Devin Booker",
    MIA: "Bam Adebayo", CLE: "Donovan Mitchell", SAC: "Domantas Sabonis", NOP: "Zion Williamson",
    ATL: "Trae Young", ORL: "Paolo Banchero", IND: "Tyrese Haliburton", HOU: "Alperen Şengün",
    DET: "Cade Cunningham", CHI: "Coby White", WAS: "Alex Sarr", UTA: "Lauri Markkanen", POR: "Scoot Henderson",
    TOR: "Scottie Barnes", CHA: "LaMelo Ball", BKN: "Cam Thomas",
  },
  NFL: {
    KC: "Patrick Mahomes", BAL: "Lamar Jackson", PHI: "Jalen Hurts", DET: "Jared Goff", GB: "Jordan Love",
    LAR: "Matthew Stafford", DAL: "Dak Prescott", CHI: "Caleb Williams", SF: "Brock Purdy", CIN: "Joe Burrow",
  },
  NHL: {
    EDM: "Connor McDavid", PIT: "Sidney Crosby", TOR: "Auston Matthews", COL: "Nathan MacKinnon",
    FLA: "Matthew Tkachuk", BOS: "David Pastrňák", NYR: "Artemi Panarin", CHI: "Connor Bedard",
  },
};

const LEAGUE_NAMES: Record<string, string> = {
  NBA: "NBA", NFL: "NFL", NHL: "NHL", NCAAF: "College Football", NCAAM: "College Basketball",
  UCL: "Champions League", MLS: "MLS", LIGAMX: "Liga MX",
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

function tiersFor(league: string, seed: string): TicketTier[] {
  const base = { NBA: 95, NFL: 140, NHL: 70, NCAAF: 60, NCAAM: 35 }[league] ?? 55;
  const j = (hash(seed) % 30) - 10;
  const b = base + j;
  return [
    { id: "upper", name: "Upper Level", section: "Sec 312 · Row 14", price: Math.round(b * 0.7) },
    { id: "lower", name: "Lower Level", section: "Sec 108 · Row 9", price: Math.round(b * 1.6) },
    { id: "club", name: "Club Seats", section: "Club 4 · Row C", price: Math.round(b * 3.1) },
    { id: "court", name: league === "NHL" ? "Glass Seats" : league === "NFL" ? "Field Level" : "Courtside", section: "Floor A · Row 1", price: Math.round(b * 9) },
  ];
}

export const marketRootOf = (ticker: string) => ticker.split("-").slice(0, 4).join("-");

function isMoneyline(e: GEvent) {
  return e.category === "Sports" && !e.title.includes(":") && e.participants.length === 2;
}

function teamColor(e: GEvent, side: "home" | "away") {
  return e.contracts.find((c) => c.sportsSide === side)?.color ?? (side === "home" ? "#1d4ed8" : "#b91c1c");
}

export function sportsEventFrom(e: GEvent): TicketEvent | null {
  const league = e.ticker.split("-")[0];
  const home = e.participants.find((p) => p.side === "home");
  const away = e.participants.find((p) => p.side === "away");
  if (!home || !away || !e.startTime) return null;
  const root = marketRootOf(e.ticker);
  const venue = ARENAS[league]?.[home.abbreviation] ?? `${home.name.split(" ").slice(0, -1).join(" ") || home.name} Home Venue`;
  return {
    id: root.toLowerCase(),
    kind: "sports",
    title: `${away.name} at ${home.name}`,
    subtitle: `${LEAGUE_NAMES[league] ?? league} · Regular Season`,
    league,
    venue,
    city: home.name.split(" ").slice(0, -1).join(" ") || home.name,
    startTime: e.startTime,
    home: { name: home.name, abbr: home.abbreviation, side: "home", color: teamColor(e, "home") },
    away: { name: away.name, abbr: away.abbreviation, side: "away", color: teamColor(e, "away") },
    marketRoot: root,
    tiers: tiersFor(league, root),
    heroFrom: teamColor(e, "away"),
    heroTo: teamColor(e, "home"),
  };
}

const CONCERTS = [
  { artist: "Midnight Static", tour: "Neon Summer Tour", city: "Austin", venue: "Zilker Park Amphitheater", from: "#7c3aed", to: "#db2777" },
  { artist: "Luna Vale", tour: "Open Sky Sessions", city: "Los Angeles", venue: "Hollywood Hills Bowl", from: "#0ea5e9", to: "#6366f1" },
  { artist: "The Copper Lines", tour: "Harvest Moon Festival", city: "Nashville", venue: "Riverfront Park", from: "#f59e0b", to: "#dc2626" },
  { artist: "Sol Reyes", tour: "Golden Hour Live", city: "Miami", venue: "Bayfront Park Stage", from: "#f97316", to: "#ec4899" },
];

function concertEvents(events: GEvent[]): TicketEvent[] {
  const now = Date.now();
  const out: TicketEvent[] = [];
  for (const c of CONCERTS) {
    // pick the latest-dated (i.e. still-open) daily-high market for that city
    const wx = events
      .filter((e) => e.category === "Weather" && e.title.startsWith(`Highest temperature in ${c.city} on`))
      .filter((e) => !e.expiryDate || new Date(e.expiryDate).getTime() > now)
      .sort((a, b) => (b.expiryDate ?? "").localeCompare(a.expiryDate ?? ""))[0];
    if (!wx) continue;
    const m = wx.title.match(/on (.+?), (\d{4})/);
    const day = m ? new Date(`${m[1]}, ${m[2]} 20:00:00`) : new Date(wx.expiryDate ?? now);
    // show starts 7:30pm local-ish; store as ISO
    const start = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 1 + 24, 30)).toISOString();
    out.push({
      id: `concert-${c.artist.toLowerCase().replace(/[^a-z]+/g, "-")}-${wx.ticker.toLowerCase()}`,
      kind: "concert",
      title: `${c.artist}`,
      subtitle: `${c.tour} · Outdoor show`,
      league: "Concert",
      venue: c.venue,
      city: c.city,
      startTime: start,
      weatherTicker: wx.ticker,
      weatherTitle: wx.title,
      tiers: [
        { id: "ga", name: "General Admission Lawn", section: "Lawn · GA", price: 69 },
        { id: "reserved", name: "Reserved Seating", section: "Sec C · Row 22", price: 129 },
        { id: "pit", name: "Pit (Standing)", section: "Pit · GA", price: 189 },
        { id: "vip", name: "VIP Package", section: "VIP Deck", price: 425 },
      ],
      heroFrom: c.from,
      heroTo: c.to,
    });
  }
  return out;
}

export function buildCatalog(u: MarketUniverse, custom: TicketEvent[] = []): TicketEvent[] {
  const now = Date.now();
  const games = u.events
    .filter(isMoneyline)
    .filter((e) => e.startTime && new Date(e.startTime).getTime() > now - 3 * 3600_000)
    .map(sportsEventFrom)
    .filter((x): x is TicketEvent => !!x);
  const seen = new Set<string>();
  const uniq = games.filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true)));
  const order = ["NBA", "NFL", "NHL", "NCAAF", "NCAAM", "UCL", "MLS", "LIGAMX"];
  uniq.sort(
    (a, b) => order.indexOf(a.league) - order.indexOf(b.league) || a.startTime.localeCompare(b.startTime),
  );
  return [...custom, ...concertEvents(u.events), ...uniq];
}

export function featured(catalog: TicketEvent[]) {
  const pick = (lg: string, n: number) => catalog.filter((e) => e.league === lg && !e.custom).slice(0, n);
  return [...pick("NBA", 4), ...pick("NFL", 2), ...catalog.filter((e) => e.kind === "concert").slice(0, 2), ...pick("NHL", 2), ...pick("NCAAF", 2)];
}
