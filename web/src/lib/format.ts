export const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usd0 = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const pct = (p: number) => `${Math.round(p * 100)}%`;
const TZ = "America/Chicago";
export const dateParts = (iso: string) => {
  const d = new Date(iso);
  return {
    mon: d.toLocaleString("en-US", { month: "short", timeZone: TZ }),
    day: d.toLocaleString("en-US", { day: "numeric", timeZone: TZ }),
    dow: d.toLocaleString("en-US", { weekday: "short", timeZone: TZ }),
    time: d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ }),
    long: d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ }) + " CT",
  };
};
export const short = (h: string, n = 6) => (h.length > 2 * n + 2 ? `${h.slice(0, n + 2)}…${h.slice(-n)}` : h);
