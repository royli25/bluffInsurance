export type DemoEventId = "festival" | "nba";

export const demoEvents = {
  festival: {
    category: "Music festival · Weekend 1",
    title: "Desert Weekend",
    date: "Apr 16–18, 2027",
    venue: "Indio, California",
    unit: "pass",
    tiers: [
      { name: "General admission", detail: "All 3 days. Every stage.", price: 499 },
      { name: "GA+", detail: "More comfort, dedicated lounges.", price: 649 },
      { name: "VIP", detail: "VIP areas and premium amenities.", price: 999 },
    ],
    protections: [
      { id: "heat", name: "Heat cover", trigger: "Opening-day high reaches 100°F or more.", rate: 0.045, refund: 0.3 },
      { id: "cold", name: "Cold cover", trigger: "Opening-day high stays at 60°F or below.", rate: 0.03, refund: 0.2 },
    ],
  },
  nba: {
    category: "NBA · Regular season",
    title: "Warriors at Knicks",
    date: "Nov 27, 2026 · 7:30 PM",
    venue: "Madison Square Garden, New York",
    unit: "ticket",
    tiers: [
      { name: "Upper bowl", detail: "A great night, a great price.", price: 89 },
      { name: "Lower bowl", detail: "Closer to every play.", price: 179 },
      { name: "Courtside", detail: "Right in the action.", price: 449 },
    ],
    protections: [
      { id: "heartbreak", name: "Heartbreak cover", trigger: "The Knicks lose the game.", rate: 0.055, refund: 0.15 },
      { id: "blowout", name: "Blowout cover", trigger: "The Knicks lose by 13 points or more.", rate: 0.035, refund: 0.25 },
      { id: "star", name: "Star sits cover", trigger: "Jalen Brunson doesn’t play.", rate: 0.04, refund: 0.35 },
    ],
  },
};
