export default function StatusPill({ s }: { s: string }) {
  const c = s === "paid" ? "bg-emerald-500/15 text-emerald-300" : s === "expired" ? "bg-neutral-800 text-neutral-500" : "bg-neutral-700 text-neutral-200";
  return <span className={`rounded-md px-2 py-0.5 ${c}`}>{s}</span>;
}
